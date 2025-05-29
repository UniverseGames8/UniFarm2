import { pgTable, text, serial, integer, boolean, bigint, timestamp, numeric, json, jsonb, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Таблица с аутентификацией по имени пользователя и паролю (пароль не обязателен для Telegram)
export const authUsers = pgTable("auth_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").default('telegram_auth'), // Устанавливаем значение по умолчанию
});

// Таблица users по требованиям задачи
export const users = pgTable(
  "users", 
  {
    id: serial("id").primaryKey(),
    telegram_id: bigint("telegram_id", { mode: "number" }).unique(),
    guest_id: text("guest_id").unique(), // Уникальный идентификатор пользователя, независимый от Telegram
    username: text("username"),
    wallet: text("wallet"),
    ton_wallet_address: text("ton_wallet_address"), // Новое поле для хранения TON-адреса кошелька
    ref_code: text("ref_code").unique(), // Уникальный реферальный код для пользователя
    parent_ref_code: text("parent_ref_code"), // Реферальный код пригласившего пользователя
    balance_uni: numeric("balance_uni", { precision: 18, scale: 6 }).default("0"),
    balance_ton: numeric("balance_ton", { precision: 18, scale: 6 }).default("0"),
    // Поля для основного UNI фарминга
    uni_deposit_amount: numeric("uni_deposit_amount", { precision: 18, scale: 6 }).default("0"),
    uni_farming_start_timestamp: timestamp("uni_farming_start_timestamp"),
    uni_farming_balance: numeric("uni_farming_balance", { precision: 18, scale: 6 }).default("0"),
    uni_farming_rate: numeric("uni_farming_rate", { precision: 18, scale: 6 }).default("0"),
    uni_farming_last_update: timestamp("uni_farming_last_update"),
    // Поля для совместимости со старой системой фарминга (используются в миграции)
    uni_farming_deposit: numeric("uni_farming_deposit", { precision: 18, scale: 6 }).default("0"),
    uni_farming_activated_at: timestamp("uni_farming_activated_at"),
    created_at: timestamp("created_at").defaultNow(),
    checkin_last_date: timestamp("checkin_last_date"),
    checkin_streak: integer("checkin_streak").default(0)
  },
  (table) => {
    return {
      // Создаем индекс для parent_ref_code для оптимизации реферальных запросов
      parentRefCodeIdx: index("idx_users_parent_ref_code").on(table.parent_ref_code),
      // Индекс для ref_code уже есть (из-за unique), но для явности добавим
      refCodeIdx: index("idx_users_ref_code").on(table.ref_code),
    };
  }
);

// Таблица farming_deposits по требованиям задачи
export const farmingDeposits = pgTable("farming_deposits", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => users.id),
  amount_uni: numeric("amount_uni", { precision: 18, scale: 6 }),
  rate_uni: numeric("rate_uni", { precision: 5, scale: 2 }),
  rate_ton: numeric("rate_ton", { precision: 5, scale: 2 }),
  created_at: timestamp("created_at").defaultNow(),
  last_claim: timestamp("last_claim"),
  is_boosted: boolean("is_boosted").default(false),
  deposit_type: text("deposit_type").default("regular"), // regular, boost_1, boost_5, boost_15, boost_25
  boost_id: integer("boost_id"), // ID буст-пакета (1, 2, 3, 4)
  expires_at: timestamp("expires_at") // Для буст-пакетов (срок 365 дней)
});

// Схемы для аутентификации
export const insertAuthUserSchema = createInsertSchema(authUsers).pick({
  username: true,
  password: true,
});

export type InsertAuthUser = z.infer<typeof insertAuthUserSchema>;
export type AuthUser = typeof authUsers.$inferSelect;

// Схемы для таблицы users
export const insertUserSchema = createInsertSchema(users).pick({
  telegram_id: true,
  guest_id: true, // Добавляем guest_id в схему вставки
  username: true,
  wallet: true,
  ton_wallet_address: true,
  ref_code: true, // Добавляем поле ref_code в схему вставки
  parent_ref_code: true, // Добавляем поле parent_ref_code в схему вставки
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Схемы для таблицы farming_deposits
export const insertFarmingDepositSchema = createInsertSchema(farmingDeposits).pick({
  user_id: true,
  amount_uni: true,
  rate_uni: true,
  rate_ton: true,
  last_claim: true,
  is_boosted: true,
  deposit_type: true,
  boost_id: true,
  expires_at: true
});

export type InsertFarmingDeposit = z.infer<typeof insertFarmingDepositSchema>;
export type FarmingDeposit = typeof farmingDeposits.$inferSelect;

// Таблица transactions по требованиям задачи
export const transactions = pgTable(
  "transactions", 
  {
    id: serial("id").primaryKey(),
    user_id: integer("user_id").references(() => users.id),
    type: text("type"), // deposit / withdraw / reward / boost_bonus
    currency: text("currency"), // UNI / TON
    amount: numeric("amount", { precision: 18, scale: 6 }),
    status: text("status").default("confirmed"), // pending / confirmed / rejected
    source: text("source"), // источник транзакции (например, "TON Boost")
    category: text("category"), // категория транзакции (например, "bonus")
    tx_hash: text("tx_hash"), // хеш транзакции для блокчейн-операций
    description: text("description"), // описание транзакции
    source_user_id: integer("source_user_id"), // ID пользователя-источника (например, реферала)
    wallet_address: text("wallet_address"), // адрес кошелька для вывода средств
    data: text("data"), // JSON-строка с дополнительными данными транзакции
    created_at: timestamp("created_at").defaultNow()
  },
  (table) => {
    return {
      // Индексы для ускорения запросов к транзакциям
      userIdIdx: index("idx_transactions_user_id").on(table.user_id),
      sourceUserIdIdx: index("idx_transactions_source_user_id").on(table.source_user_id),
      typeStatusIdx: index("idx_transactions_type_status").on(table.type, table.status),
    };
  }
);

// Схемы для таблицы transactions
export const insertTransactionSchema = createInsertSchema(transactions).pick({
  user_id: true,
  type: true,
  currency: true,
  amount: true,
  status: true,
  source: true,
  category: true,
  tx_hash: true,
  description: true,
  source_user_id: true,
  wallet_address: true,
  data: true,
  created_at: true
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// Таблица referrals по требованиям задачи
export const referrals = pgTable(
  "referrals",
  {
    id: serial("id").primaryKey(),
    user_id: integer("user_id").references(() => users.id).notNull(),
    inviter_id: integer("inviter_id").references(() => users.id).notNull(),
    level: integer("level").notNull(), // Уровень (1–20)
    reward_uni: numeric("reward_uni", { precision: 18, scale: 6 }),
    ref_path: json("ref_path").array(), // Массив ID пригласителей в цепочке [inviter_id, inviter_inviter_id, ...]
    created_at: timestamp("created_at").defaultNow()
  },
  (table) => {
    return {
      // Индексы для ускорения реферальных запросов
      userIdIdx: index("idx_referrals_user_id").on(table.user_id),
      inviterIdIdx: index("idx_referrals_inviter_id").on(table.inviter_id),
      userInviterIdx: index("idx_referrals_user_inviter").on(table.user_id, table.inviter_id),
      levelIdx: index("idx_referrals_level").on(table.level),
    };
  }
);

// Схемы для таблицы referrals
export const insertReferralSchema = createInsertSchema(referrals).pick({
  user_id: true,
  inviter_id: true,
  level: true,
  reward_uni: true,
  ref_path: true,
  created_at: true
});

export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referrals.$inferSelect;

// Таблица missions по требованиям задачи
export const missions = pgTable("missions", {
  id: serial("id").primaryKey(),
  type: text("type"), // Тип миссии: invite / social / check-in / deposit и т.д.
  title: text("title"), // Название миссии
  description: text("description"), // Подробное описание
  reward_uni: numeric("reward_uni", { precision: 18, scale: 6 }), // Награда в UNI
  is_active: boolean("is_active").default(true) // Активна ли миссия
});

// Схемы для таблицы missions
export const insertMissionSchema = createInsertSchema(missions).pick({
  type: true,
  title: true,
  description: true,
  reward_uni: true,
  is_active: true
});

export type InsertMission = z.infer<typeof insertMissionSchema>;
export type Mission = typeof missions.$inferSelect;

// Таблица user_missions для отслеживания выполнения миссий пользователями
export const userMissions = pgTable("user_missions", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => users.id),
  mission_id: integer("mission_id").references(() => missions.id),
  completed_at: timestamp("completed_at").defaultNow()
});

// Схемы для таблицы user_missions
export const insertUserMissionSchema = createInsertSchema(userMissions).pick({
  user_id: true,
  mission_id: true,
  completed_at: true
});

export type InsertUserMission = z.infer<typeof insertUserMissionSchema>;
export type UserMission = typeof userMissions.$inferSelect;

// Таблица для хранения UNI фарминг-депозитов
export const uniFarmingDeposits = pgTable("uni_farming_deposits", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id),
  amount: numeric("amount", { precision: 18, scale: 6 }).notNull(), // Сумма UNI в депозите
  created_at: timestamp("created_at").defaultNow().notNull(), // Дата открытия
  rate_per_second: numeric("rate_per_second", { precision: 20, scale: 18 }).notNull(), // Расчетная скорость фарминга
  last_updated_at: timestamp("last_updated_at").defaultNow().notNull(), // Время последнего начисления
  is_active: boolean("is_active").default(true), // Активен ли депозит
});

// Схемы для таблицы uni_farming_deposits
export const insertUniFarmingDepositSchema = createInsertSchema(uniFarmingDeposits).pick({
  user_id: true,
  amount: true,
  rate_per_second: true,
  is_active: true
});

export type InsertUniFarmingDeposit = z.infer<typeof insertUniFarmingDepositSchema>;
export type UniFarmingDeposit = typeof uniFarmingDeposits.$inferSelect;

// Таблица для хранения UNI Boost-депозитов
export const boostDeposits = pgTable("boost_deposits", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id),
  boost_id: integer("boost_id").notNull(), // ID буст-пакета
  start_date: timestamp("start_date").notNull(), // Дата начала срока действия буста
  end_date: timestamp("end_date").notNull(), // Дата окончания срока действия буста
  bonus_uni: numeric("bonus_uni", { precision: 18, scale: 6 }).notNull(), // Единоразовый бонус UNI
  created_at: timestamp("created_at").defaultNow().notNull() // Дата создания записи
});

// Схемы для таблицы boost_deposits
export const insertBoostDepositSchema = createInsertSchema(boostDeposits).pick({
  user_id: true,
  boost_id: true,
  start_date: true,
  end_date: true,
  bonus_uni: true
});

export type InsertBoostDeposit = z.infer<typeof insertBoostDepositSchema>;
export type BoostDeposit = typeof boostDeposits.$inferSelect;

// Таблица для хранения TON Boost-депозитов
export const tonBoostDeposits = pgTable("ton_boost_deposits", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id),
  ton_amount: numeric("ton_amount", { precision: 18, scale: 5 }).notNull(), // Сумма TON в депозите
  bonus_uni: numeric("bonus_uni", { precision: 18, scale: 6 }).notNull(), // Единоразовый бонус UNI
  rate_ton_per_second: numeric("rate_ton_per_second", { precision: 20, scale: 18 }).notNull(), // Скорость фарминга TON
  rate_uni_per_second: numeric("rate_uni_per_second", { precision: 20, scale: 18 }).notNull(), // Скорость фарминга UNI
  accumulated_ton: numeric("accumulated_ton", { precision: 18, scale: 10 }).default("0"), // Накопленный TON, ожидающий начисления
  created_at: timestamp("created_at").defaultNow().notNull(), // Дата открытия
  last_updated_at: timestamp("last_updated_at").defaultNow().notNull(), // Время последнего начисления
  is_active: boolean("is_active").default(true) // Активен ли буст
});

// Схемы для таблицы ton_boost_deposits
export const insertTonBoostDepositSchema = createInsertSchema(tonBoostDeposits).pick({
  user_id: true,
  ton_amount: true,
  bonus_uni: true,
  rate_ton_per_second: true,
  rate_uni_per_second: true,
  accumulated_ton: true,
  is_active: true
});

export type InsertTonBoostDeposit = z.infer<typeof insertTonBoostDepositSchema>;
export type TonBoostDeposit = typeof tonBoostDeposits.$inferSelect;

// Таблица для логирования запусков Mini App (Этап 5.1)
export const launchLogs = pgTable("launch_logs", {
  id: serial("id").primaryKey(),
  telegram_user_id: bigint("telegram_user_id", { mode: "number" }),
  ref_code: text("ref_code"),
  platform: text("platform"), // android / ios / web / unknown
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  user_agent: text("user_agent"),
  init_data: text("init_data"),
  ip_address: text("ip_address"),
  request_id: text("request_id"), // Для отслеживания уникальных запросов
  user_id: integer("user_id").references(() => users.id) // Связь с таблицей пользователей (если есть)
});

// Таблица для логирования операций с партициями
export const partition_logs = pgTable("partition_logs", {
  id: serial("id").primaryKey(),
  operation: text("operation").notNull(), // CREATE, DROP, INFO, ERROR
  partition_name: text("partition_name"),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  status: text("status").notNull(), // success, error
  error_details: text("error_details")
});

// Таблица для логов распределения реферальных вознаграждений
export const reward_distribution_logs = pgTable("reward_distribution_logs", {
  id: serial("id").primaryKey(),
  batch_id: text("batch_id").notNull(), // Уникальный ID пакета операций
  source_user_id: integer("source_user_id").notNull(), // ID пользователя, от которого идёт распределение
  earned_amount: numeric("earned_amount", { precision: 18, scale: 6 }).notNull(), // Сумма исходного действия
  currency: text("currency").notNull(), // Валюта (UNI/TON)
  processed_at: timestamp("processed_at"), // Время обработки сообщения
  status: text("status").default("pending"), // pending / completed / failed
  levels_processed: integer("levels_processed"), // Количество обработанных уровней
  inviter_count: integer("inviter_count"), // Количество пригласителей
  total_distributed: numeric("total_distributed", { precision: 18, scale: 6 }), // Общая распределенная сумма
  error_message: text("error_message"), // Ошибка при обработке, если была
  completed_at: timestamp("completed_at") // Время завершения обработки
});

// Таблица для метрик производительности
export const performance_metrics = pgTable(
  "performance_metrics", 
  {
    id: serial("id").primaryKey(),
    operation: text("operation").notNull(), // Тип операции (process_batch, queue_reward, и т.д.)
    batch_id: text("batch_id"), // ID связанного пакета распределения
    duration_ms: numeric("duration_ms", { precision: 12, scale: 2 }).notNull(), // Длительность операции в миллисекундах
    timestamp: timestamp("timestamp").defaultNow().notNull(), // Время записи метрики
    details: text("details") // Дополнительные детали (JSON-строка)
  },
  (table) => {
    return {
      // Индексы для эффективного анализа метрик производительности
      timestampIdx: index("idx_performance_metrics_timestamp").on(table.timestamp),
      operationIdx: index("idx_performance_metrics_operation").on(table.operation),
      batchIdIdx: index("idx_performance_metrics_batch_id").on(table.batch_id),
    };
  }
);

// Схемы для таблицы partition_logs
export const insertPartitionLogSchema = createInsertSchema(partition_logs).pick({
  operation: true,
  partition_name: true,
  message: true,
  timestamp: true,
  status: true,
  error_details: true
});

export type InsertPartitionLog = z.infer<typeof insertPartitionLogSchema>;
export type PartitionLog = typeof partition_logs.$inferSelect;

// Схемы для таблицы reward_distribution_logs
export const insertRewardDistributionLogSchema = createInsertSchema(reward_distribution_logs).pick({
  batch_id: true,
  source_user_id: true,
  earned_amount: true,
  currency: true,
  status: true,
  levels_processed: true,
  inviter_count: true,
  total_distributed: true,
  error_message: true,
  completed_at: true
});

export type InsertRewardDistributionLog = z.infer<typeof insertRewardDistributionLogSchema>;
export type RewardDistributionLog = typeof reward_distribution_logs.$inferSelect;

// Схемы для таблицы performance_metrics
export const insertPerformanceMetricSchema = createInsertSchema(performance_metrics).pick({
  operation: true,
  batch_id: true,
  duration_ms: true,
  timestamp: true,
  details: true
});

export type InsertPerformanceMetric = z.infer<typeof insertPerformanceMetricSchema>;
export type PerformanceMetric = typeof performance_metrics.$inferSelect;

// Таблица boost_packages для хранения доступных буст-пакетов
export const boostPackages = pgTable("boost_packages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price_uni: numeric("price_uni", { precision: 18, scale: 6 }).notNull(),
  rate_multiplier: numeric("rate_multiplier", { precision: 5, scale: 2 }).notNull(),
  duration_days: integer("duration_days").default(365),
  is_active: boolean("is_active").default(true),
  created_at: timestamp("created_at").defaultNow()
});

// Схемы для таблицы boost_packages
export const insertBoostPackageSchema = createInsertSchema(boostPackages).pick({
  name: true,
  description: true,
  price_uni: true,
  rate_multiplier: true,
  duration_days: true,
  is_active: true
});

export type InsertBoostPackage = z.infer<typeof insertBoostPackageSchema>;
export type BoostPackage = typeof boostPackages.$inferSelect;

// Схемы для таблицы launch_logs
export const insertLaunchLogSchema = createInsertSchema(launchLogs).pick({
  telegram_user_id: true,
  ref_code: true,
  platform: true,
  timestamp: true,
  user_agent: true, 
  init_data: true,
  ip_address: true,
  request_id: true,
  user_id: true
});

export type InsertLaunchLog = z.infer<typeof insertLaunchLogSchema>;
export type LaunchLog = typeof launchLogs.$inferSelect;