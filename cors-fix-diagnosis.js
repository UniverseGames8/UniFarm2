/**
 * Диагностический скрипт для проверки и анализа проблем с CORS в Express
 * Скрипт предлагает варианты исправления CORS конфигурации для поддержки cookies
 * 
 * Использование:
 * node cors-fix-diagnosis.js
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');

// Цвета для вывода в консоль
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Пути к файлам для проверки
const filesToCheck = [
  './server/index.ts',
  './server/routes.ts',
  './server/app.ts',
  './server/middleware/cors.ts',
  './server/middleware/session.ts',
  './server/vite.ts'
];

// Запуск диагностики
console.log(`${colors.cyan}[CORS Диагностика]${colors.reset} 🔍 Начало диагностики настроек CORS`);

// Функция для логирования с цветами
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Функция для проверки файла на наличие определенных шаблонов
function checkFileForPatterns(filePath, patterns) {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        exists: false,
        message: `Файл ${filePath} не существует`
      };
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const results = {};
    
    for (const [key, pattern] of Object.entries(patterns)) {
      results[key] = pattern.test(content);
    }
    
    return {
      exists: true,
      matches: results,
      content: content
    };
  } catch (error) {
    return {
      exists: false,
      error: error.message
    };
  }
}

// Шаблоны для проверки CORS настроек
const corsPatterns = {
  cors: /cors\(/i,
  usesCors: /app\.use\(\s*cors/i,
  credentialsTrue: /credentials\s*:\s*true/i,
  allowOrigin: /origin\s*:/i,
  allowOriginStar: /origin\s*:\s*['"]?\*['"]?/i,
  allowOriginFunction: /origin\s*:\s*(?:function|\()/i,
  allowHeaders: /allowedHeaders|allowHeaders|Access-Control-Allow-Headers/i,
  allowTelegramHeaders: /telegram|init-data/i,
  enableCors: /enableCors|setupCors|configureCors/i
};

// Шаблоны для проверки настроек сессий
const sessionPatterns = {
  session: /express-session|cookie-session|session\(/i,
  secure: /secure\s*:\s*true/i,
  sameSite: /sameSite\s*:/i,
  sameSiteNone: /sameSite\s*:\s*['"]?none['"]?/i,
  httpOnly: /httpOnly\s*:\s*true/i,
  cookieDomain: /domain\s*:/i,
  memoryStore: /MemoryStore|new\s+session\.Store/i
};

// Анализ настроек CORS
async function analyzeCorsSettings() {
  log('\n[CORS Диагностика] 🔍 Анализ настроек CORS...', colors.cyan);
  
  const corsResults = [];
  const problems = [];
  const detailedFindings = {};
  
  for (const filePath of filesToCheck) {
    const result = checkFileForPatterns(filePath, corsPatterns);
    
    if (result.exists) {
      corsResults.push({
        filePath,
        matches: result.matches
      });
      
      // Добавляем детальную информацию в результаты
      if (result.matches.cors || result.matches.usesCors) {
        detailedFindings[filePath] = {
          hasCors: result.matches.cors || result.matches.usesCors,
          corsConfiguration: extractCorsConfiguration(result.content),
          credentialsEnabled: result.matches.credentialsTrue,
          hasAllowOrigin: result.matches.allowOrigin,
          hasStarOrigin: result.matches.allowOriginStar,
          hasAllowHeaders: result.matches.allowHeaders,
          hasTelegramHeaders: result.matches.allowTelegramHeaders
        };
      }
      
      // Проверяем на проблемы
      if ((result.matches.cors || result.matches.usesCors) && !result.matches.credentialsTrue) {
        problems.push({
          filePath, 
          problem: 'CORS настроен без credentials: true, что блокирует передачу cookies',
          location: findLineInContent(result.content, /cors\(/),
          severity: 'critical'
        });
      }
      
      if (result.matches.credentialsTrue && result.matches.allowOriginStar) {
        problems.push({
          filePath,
          problem: 'Обнаружена недопустимая комбинация: credentials: true и origin: "*", что блокирует работу CORS',
          location: findLineInContent(result.content, /origin\s*:\s*['"]?\*['"]?/),
          severity: 'critical'
        });
      }
      
      if ((result.matches.cors || result.matches.usesCors) && !result.matches.allowTelegramHeaders) {
        problems.push({
          filePath,
          problem: 'CORS настроен без явных разрешений для заголовков Telegram (telegram-data, x-telegram-data и т.д.)',
          location: findLineInContent(result.content, /allowedHeaders|allowHeaders/),
          severity: 'high'
        });
      }
    }
  }
  
  // Подсчитываем количество файлов с настройками CORS
  const filesWithCors = corsResults.filter(result => 
    result.matches.cors || result.matches.usesCors || result.matches.enableCors
  ).length;
  
  log(`\n[CORS Диагностика] 📊 Найдено ${filesWithCors} файлов с настройками CORS`, colors.cyan);
  
  // Выводим подробную информацию о настройках CORS
  for (const [filePath, details] of Object.entries(detailedFindings)) {
    log(`\n[CORS Диагностика] 📄 Файл: ${filePath}`, colors.cyan);
    log(`  - CORS настроен: ${details.hasCors ? '✅' : '❌'}`, details.hasCors ? colors.green : colors.red);
    
    if (details.corsConfiguration) {
      log(`  - Конфигурация CORS:`, colors.yellow);
      log(`${details.corsConfiguration}`, colors.reset);
    }
    
    log(`  - Credentials включены: ${details.credentialsEnabled ? '✅' : '❌'}`, details.credentialsEnabled ? colors.green : colors.red);
    log(`  - Origin настроен: ${details.hasAllowOrigin ? '✅' : '❌'}`, details.hasAllowOrigin ? colors.green : colors.red);
    
    if (details.hasAllowOrigin) {
      if (details.hasStarOrigin) {
        log(`  - Используется wildcard origin "*": ⚠️`, colors.yellow);
        log(`    Это не работает с credentials: true!`, colors.red);
      }
    }
    
    log(`  - Headers настроены: ${details.hasAllowHeaders ? '✅' : '❌'}`, details.hasAllowHeaders ? colors.green : colors.red);
    log(`  - Telegram заголовки: ${details.hasTelegramHeaders ? '✅' : '❌'}`, details.hasTelegramHeaders ? colors.green : colors.red);
  }
  
  // Выводим обнаруженные проблемы
  if (problems.length > 0) {
    log('\n[CORS Диагностика] ⚠️ Обнаружены проблемы:', colors.yellow);
    
    const criticalProblems = problems.filter(p => p.severity === 'critical');
    const highProblems = problems.filter(p => p.severity === 'high');
    const otherProblems = problems.filter(p => p.severity !== 'critical' && p.severity !== 'high');
    
    if (criticalProblems.length > 0) {
      log('\n🔴 Критические проблемы:', colors.red);
      criticalProblems.forEach((problem, index) => {
        log(`${index + 1}. ${problem.problem}`, colors.red);
        log(`   Файл: ${problem.filePath}${problem.location ? `, строка: ${problem.location}` : ''}`, colors.yellow);
      });
    }
    
    if (highProblems.length > 0) {
      log('\n🟠 Важные проблемы:', colors.yellow);
      highProblems.forEach((problem, index) => {
        log(`${index + 1}. ${problem.problem}`, colors.yellow);
        log(`   Файл: ${problem.filePath}${problem.location ? `, строка: ${problem.location}` : ''}`, colors.yellow);
      });
    }
    
    if (otherProblems.length > 0) {
      log('\n🟡 Другие проблемы:', colors.white);
      otherProblems.forEach((problem, index) => {
        log(`${index + 1}. ${problem.problem}`, colors.white);
        log(`   Файл: ${problem.filePath}${problem.location ? `, строка: ${problem.location}` : ''}`, colors.yellow);
      });
    }
  } else {
    log('\n[CORS Диагностика] ✅ Проблем с настройками CORS не обнаружено', colors.green);
  }
  
  return {
    filesWithCors,
    problems,
    detailedFindings
  };
}

// Анализ настроек сессий
async function analyzeSessionSettings() {
  log('\n[CORS Диагностика] 🔍 Анализ настроек сессий...', colors.cyan);
  
  const sessionResults = [];
  const problems = [];
  const detailedFindings = {};
  
  for (const filePath of filesToCheck) {
    const result = checkFileForPatterns(filePath, sessionPatterns);
    
    if (result.exists) {
      sessionResults.push({
        filePath,
        matches: result.matches
      });
      
      // Добавляем детальную информацию в результаты
      if (result.matches.session) {
        detailedFindings[filePath] = {
          hasSession: result.matches.session,
          sessionConfiguration: extractSessionConfiguration(result.content),
          secureEnabled: result.matches.secure,
          hasSameSite: result.matches.sameSite,
          hasSameSiteNone: result.matches.sameSiteNone,
          httpOnlyEnabled: result.matches.httpOnly,
          hasCookieDomain: result.matches.cookieDomain,
          usesMemoryStore: result.matches.memoryStore
        };
      }
      
      // Проверяем на проблемы
      if (result.matches.session && !result.matches.secure) {
        problems.push({
          filePath,
          problem: 'Сессия настроена без флага secure: true, что небезопасно для production',
          location: findLineInContent(result.content, /session\(/),
          severity: 'high'
        });
      }
      
      if (result.matches.session && !result.matches.sameSite) {
        problems.push({
          filePath,
          problem: 'Сессия настроена без параметра sameSite, что может вызвать проблемы с CORS',
          location: findLineInContent(result.content, /session\(/),
          severity: 'high'
        });
      }
      
      if (result.matches.session && !result.matches.httpOnly) {
        problems.push({
          filePath,
          problem: 'Сессия настроена без флага httpOnly: true, что снижает безопасность',
          location: findLineInContent(result.content, /session\(/),
          severity: 'medium'
        });
      }
      
      if (result.matches.session && result.matches.memoryStore) {
        problems.push({
          filePath,
          problem: 'Используется MemoryStore для хранения сессий, что не подходит для production',
          location: findLineInContent(result.content, /MemoryStore|new\s+session\.Store/),
          severity: 'medium'
        });
      }
    }
  }
  
  // Подсчитываем количество файлов с настройками сессий
  const filesWithSession = sessionResults.filter(result => result.matches.session).length;
  
  log(`\n[CORS Диагностика] 📊 Найдено ${filesWithSession} файлов с настройками сессий`, colors.cyan);
  
  // Выводим подробную информацию о настройках сессий
  for (const [filePath, details] of Object.entries(detailedFindings)) {
    log(`\n[CORS Диагностика] 📄 Файл: ${filePath}`, colors.cyan);
    log(`  - Сессия настроена: ${details.hasSession ? '✅' : '❌'}`, details.hasSession ? colors.green : colors.red);
    
    if (details.sessionConfiguration) {
      log(`  - Конфигурация сессии:`, colors.yellow);
      log(`${details.sessionConfiguration}`, colors.reset);
    }
    
    log(`  - Secure включен: ${details.secureEnabled ? '✅' : '❌'}`, details.secureEnabled ? colors.green : colors.red);
    log(`  - SameSite настроен: ${details.hasSameSite ? '✅' : '❌'}`, details.hasSameSite ? colors.green : colors.red);
    
    if (details.hasSameSite) {
      if (details.hasSameSiteNone) {
        log(`  - Используется sameSite: 'none': ✅`, colors.green);
      } else {
        log(`  - SameSite не установлен в 'none', может вызвать проблемы с CORS: ⚠️`, colors.yellow);
      }
    }
    
    log(`  - HttpOnly включен: ${details.httpOnlyEnabled ? '✅' : '❌'}`, details.httpOnlyEnabled ? colors.green : colors.red);
    log(`  - Domain настроен: ${details.hasCookieDomain ? '✅' : '❌'}`, details.hasCookieDomain ? colors.green : colors.yellow);
    log(`  - MemoryStore: ${details.usesMemoryStore ? '⚠️' : '✅'}`, details.usesMemoryStore ? colors.yellow : colors.green);
  }
  
  // Выводим обнаруженные проблемы
  if (problems.length > 0) {
    log('\n[CORS Диагностика] ⚠️ Обнаружены проблемы с сессиями:', colors.yellow);
    
    const highProblems = problems.filter(p => p.severity === 'high');
    const mediumProblems = problems.filter(p => p.severity === 'medium');
    const lowProblems = problems.filter(p => p.severity === 'low');
    
    if (highProblems.length > 0) {
      log('\n🟠 Важные проблемы:', colors.yellow);
      highProblems.forEach((problem, index) => {
        log(`${index + 1}. ${problem.problem}`, colors.yellow);
        log(`   Файл: ${problem.filePath}${problem.location ? `, строка: ${problem.location}` : ''}`, colors.yellow);
      });
    }
    
    if (mediumProblems.length > 0) {
      log('\n🟡 Проблемы средней важности:', colors.white);
      mediumProblems.forEach((problem, index) => {
        log(`${index + 1}. ${problem.problem}`, colors.white);
        log(`   Файл: ${problem.filePath}${problem.location ? `, строка: ${problem.location}` : ''}`, colors.yellow);
      });
    }
    
    if (lowProblems.length > 0) {
      log('\n🟢 Незначительные проблемы:', colors.green);
      lowProblems.forEach((problem, index) => {
        log(`${index + 1}. ${problem.problem}`, colors.green);
        log(`   Файл: ${problem.filePath}${problem.location ? `, строка: ${problem.location}` : ''}`, colors.yellow);
      });
    }
  } else {
    log('\n[CORS Диагностика] ✅ Проблем с настройками сессий не обнаружено', colors.green);
  }
  
  return {
    filesWithSession,
    problems,
    detailedFindings
  };
}

// Извлечение конфигурации CORS из содержимого файла
function extractCorsConfiguration(content) {
  const corsRegex = /app\.use\(\s*cors\(([^;]*)\)\s*\)/s;
  const corsOptionsRegex = /const\s+corsOptions\s*=\s*({[^;]*})/s;
  
  let corsConfig = null;
  
  // Пытаемся найти прямую конфигурацию в app.use(cors(...))
  const corsMatch = content.match(corsRegex);
  if (corsMatch && corsMatch[1]) {
    corsConfig = corsMatch[1].trim();
  }
  
  // Если не нашли прямую конфигурацию, ищем настройки в переменной
  if (!corsConfig) {
    const corsOptionsMatch = content.match(corsOptionsRegex);
    if (corsOptionsMatch && corsOptionsMatch[1]) {
      corsConfig = corsOptionsMatch[1].trim();
    }
  }
  
  return corsConfig;
}

// Извлечение конфигурации сессии из содержимого файла
function extractSessionConfiguration(content) {
  const sessionRegex = /app\.use\(\s*session\(([^;]*)\)\s*\)/s;
  const sessionOptionsRegex = /const\s+sessionConfig\s*=\s*({[^;]*})/s;
  
  let sessionConfig = null;
  
  // Пытаемся найти прямую конфигурацию в app.use(session(...))
  const sessionMatch = content.match(sessionRegex);
  if (sessionMatch && sessionMatch[1]) {
    sessionConfig = sessionMatch[1].trim();
  }
  
  // Если не нашли прямую конфигурацию, ищем настройки в переменной
  if (!sessionConfig) {
    const sessionOptionsMatch = content.match(sessionOptionsRegex);
    if (sessionOptionsMatch && sessionOptionsMatch[1]) {
      sessionConfig = sessionOptionsMatch[1].trim();
    }
  }
  
  return sessionConfig;
}

// Поиск номера строки с определенным шаблоном в содержимом файла
function findLineInContent(content, pattern) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      return i + 1;
    }
  }
  return null;
}

// Генерация примера правильной конфигурации CORS
function generateCorrectCorsConfig() {
  return `const corsOptions = {
  origin: function(origin, callback) {
    const allowedOrigins = [
      'https://web.telegram.org',
      'https://t.me',
      // другие нужные домены
    ];
    
    // Разрешаем запросы без origin (например, от мобильных приложений)
    // или запросы с разрешенных доменов
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Заблокировано политикой CORS'));
    }
  },
  credentials: true,
  allowedHeaders: [
    'Content-Type', 
    'Authorization',
    'X-Requested-With',
    'X-Telegram-Init-Data',
    'Telegram-Init-Data',
    'X-Telegram-Data',
    'Telegram-Data',
    'X-Telegram-Auth',
    'X-Telegram-User-Id',
    'X-Telegram-Start-Param'
  ],
  methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));`;
}

// Генерация примера правильной конфигурации сессии
function generateCorrectSessionConfig() {
  return `const sessionConfig = {
  secret: 'your-secure-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true в production
    httpOnly: true,
    sameSite: 'none', // важно для работы с Telegram
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней
  },
  // Использовать вместо MemoryStore в production:
  // store: new PgStore({
  //   conString: process.env.DATABASE_URL,
  //   tableName: 'sessions' // убедитесь, что таблица существует
  // }),
};

app.use(session(sessionConfig));`;
}

// Генерация рекомендаций по исправлению
function generateRecommendations(corsResults, sessionResults) {
  log('\n[CORS Диагностика] 📝 Рекомендации по исправлению:', colors.cyan);
  
  // Рекомендации по CORS
  if (corsResults.problems.length > 0) {
    log('\n1. Для исправления проблем с CORS:', colors.yellow);
    
    const hasCriticalCorsProblems = corsResults.problems.some(p => p.severity === 'critical');
    
    if (hasCriticalCorsProblems) {
      log('\nПример правильной конфигурации CORS:', colors.green);
      log(generateCorrectCorsConfig(), colors.reset);
    }
    
    // Специфичные рекомендации по CORS
    if (corsResults.problems.some(p => p.problem.includes('credentials: true'))) {
      log('\n- Включите поддержку credentials для работы с cookies:', colors.yellow);
      log('  credentials: true,', colors.green);
    }
    
    if (corsResults.problems.some(p => p.problem.includes('origin: "*"'))) {
      log('\n- Замените wildcard origin на функцию или список конкретных доменов:', colors.yellow);
      log('  origin: [\'https://web.telegram.org\', \'https://t.me\'],', colors.green);
    }
    
    if (corsResults.problems.some(p => p.problem.includes('заголовков Telegram'))) {
      log('\n- Добавьте заголовки Telegram в список разрешенных:', colors.yellow);
      log('  allowedHeaders: [\'Content-Type\', \'Authorization\', \'X-Telegram-Init-Data\', \'Telegram-Init-Data\'],', colors.green);
    }
  }
  
  // Рекомендации по сессиям
  if (sessionResults.problems.length > 0) {
    log('\n2. Для исправления проблем с сессиями:', colors.yellow);
    
    const hasHighSessionProblems = sessionResults.problems.some(p => p.severity === 'high');
    
    if (hasHighSessionProblems) {
      log('\nПример правильной конфигурации сессии:', colors.green);
      log(generateCorrectSessionConfig(), colors.reset);
    }
    
    // Специфичные рекомендации по сессиям
    if (sessionResults.problems.some(p => p.problem.includes('secure: true'))) {
      log('\n- Включите флаг secure для cookies:', colors.yellow);
      log('  cookie: { secure: true, ... },', colors.green);
    }
    
    if (sessionResults.problems.some(p => p.problem.includes('sameSite'))) {
      log('\n- Установите sameSite: \'none\' для работы в контексте Telegram:', colors.yellow);
      log('  cookie: { sameSite: \'none\', ... },', colors.green);
    }
    
    if (sessionResults.problems.some(p => p.problem.includes('httpOnly: true'))) {
      log('\n- Включите флаг httpOnly для повышения безопасности:', colors.yellow);
      log('  cookie: { httpOnly: true, ... },', colors.green);
    }
    
    if (sessionResults.problems.some(p => p.problem.includes('MemoryStore'))) {
      log('\n- Замените MemoryStore на PgStore для production:', colors.yellow);
      log('  store: new PgStore({ conString: process.env.DATABASE_URL }),', colors.green);
    }
  }
  
  // Общие рекомендации
  log('\n3. Общие рекомендации:', colors.cyan);
  log('- Создайте таблицу sessions в базе данных для хранения сессий', colors.white);
  log('- Проверьте, что все middleware применяются в правильном порядке (CORS перед session)', colors.white);
  log('- Убедитесь, что фронтенд правильно передает credentials при кросс-доменных запросах', colors.white);
  log('- В Telegram Mini App, используйте fetch с { credentials: \'include\' }', colors.white);
}

// Запуск всех проверок
async function runAllChecks() {
  try {
    // Анализ настроек CORS
    const corsResults = await analyzeCorsSettings();
    
    // Анализ настроек сессий
    const sessionResults = await analyzeSessionSettings();
    
    // Генерация рекомендаций
    generateRecommendations(corsResults, sessionResults);
    
    log('\n[CORS Диагностика] 🏁 Диагностика завершена', colors.cyan);
    
  } catch (error) {
    log(`[CORS Диагностика] ❌ Критическая ошибка при диагностике: ${error.message}`, colors.red);
    console.error(error);
  }
}

// Запускаем все проверки
runAllChecks();