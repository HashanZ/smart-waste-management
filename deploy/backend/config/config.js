"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
const config = {
    nodeEnv: process.env['NODE_ENV'] || 'development',
    port: parseInt(process.env['API_PORT'] || '3000', 10),
    cors: {
        origin: process.env['CORS_ORIGIN']?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
        credentials: true
    },
    jwt: {
        secret: process.env['JWT_SECRET'] || 'your-super-secret-jwt-key-here',
        expiresIn: process.env['JWT_EXPIRES_IN'] || '24h'
    },
    database: {
        mongodbUri: process.env['MONGODB_URI'] || 'mongodb://localhost:27017/smartwaste',
        redisUrl: process.env['REDIS_URL'] || 'redis://localhost:6379'
    },
    mqtt: {
        brokerUrl: process.env['MQTT_BROKER_URL'] || 'mqtt://localhost:1883',
        clientId: process.env['MQTT_CLIENT_ID'] || 'smart-waste-backend',
        topicPrefix: process.env['MQTT_TOPIC_PREFIX'] || 'smartwaste',
        username: process.env['MQTT_USERNAME'] || undefined,
        password: process.env['MQTT_PASSWORD'] || undefined
    },
    aws: {
        iotEndpoint: process.env['AWS_IOT_ENDPOINT'] || '',
        accessKeyId: process.env['AWS_ACCESS_KEY_ID'] || '',
        secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] || '',
        region: process.env['AWS_REGION'] || 'us-east-1'
    },
    ml: {
        serviceUrl: process.env['ML_SERVICE_URL'] || 'http://localhost:8888'
    },
    email: {
        smtp: {
            host: process.env['SMTP_HOST'] || 'smtp.gmail.com',
            port: parseInt(process.env['SMTP_PORT'] || '587', 10),
            user: process.env['SMTP_USER'] || '',
            pass: process.env['SMTP_PASS'] || ''
        }
    },
    upload: {
        maxFileSize: parseInt(process.env['MAX_FILE_SIZE'] || '10485760', 10),
        path: process.env['UPLOAD_PATH'] || './uploads'
    },
    monitoring: {
        logLevel: process.env['LOG_LEVEL'] || 'info',
        enableMetrics: process.env['ENABLE_METRICS'] === 'true'
    },
    logging: {
        level: process.env['LOG_LEVEL'] || 'info'
    },
    mobile: {
        fcmServerKey: process.env['FCM_SERVER_KEY'] || '',
        fcmSenderId: process.env['FCM_SENDER_ID'] || ''
    }
};
exports.config = config;
const requiredEnvVars = [];
if (config.nodeEnv === 'production' && !process.env['JWT_SECRET']) {
    requiredEnvVars.push('JWT_SECRET');
}
if (config.nodeEnv === 'production') {
    requiredEnvVars.push('AWS_IOT_ENDPOINT', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY');
}
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}
if (config.nodeEnv === 'development' && process.env['JWT_SECRET'] === undefined) {
    console.warn('⚠️  Warning: Using default JWT_SECRET. Set JWT_SECRET in .env for production.');
}
//# sourceMappingURL=config.js.map