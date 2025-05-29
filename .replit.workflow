run = "NODE_ENV=production PORT=3000 DATABASE_PROVIDER=neon FORCE_NEON_DB=true DISABLE_REPLIT_DB=true OVERRIDE_DB_PROVIDER=neon node start-deployment.js"
modules = ["postgresql-16", "nodejs-20"]

[nix]
channel = "stable-23_05"
packages = ["postgresql", "jq", "wget", "lsof"]

[env]
DATABASE_PROVIDER = "neon"
FORCE_NEON_DB = "true"
DISABLE_REPLIT_DB = "true" 
OVERRIDE_DB_PROVIDER = "neon"
NODE_ENV = "production"
PORT = "3000"

[deployment]
run = ["sh", "-c", "PORT=3000 NODE_ENV=production DATABASE_PROVIDER=neon FORCE_NEON_DB=true DISABLE_REPLIT_DB=true OVERRIDE_DB_PROVIDER=neon node start-deployment.js"]
deploymentTarget = "cloudrun"
ignorePorts = false

[[ports]]
localPort = 80
externalPort = 3001

[[ports]]
localPort = 3000
externalPort = 80

[[ports]]
localPort = 5432
externalPort = 3000
exposeLocalhost = true

[workflows]

[[workflows.workflow]]
name = "Neon DB Server"
mode = "sequential"
author = 42521392

[[workflows.workflow.tasks]]
task = "shell.exec"
args = "DATABASE_PROVIDER=neon FORCE_NEON_DB=true DISABLE_REPLIT_DB=true OVERRIDE_DB_PROVIDER=neon node start-deployment.js"

[[workflows.workflow]]
name = "Neon"
mode = "sequential"
author = 42521392

[[workflows.workflow.tasks]]
task = "shell.exec"
args = "node neon-workflow.js"

[[workflows.workflow]]
name = "Start application"
mode = "sequential"

[[workflows.workflow.tasks]]
task = "shell.exec"
args = "npm run dev"