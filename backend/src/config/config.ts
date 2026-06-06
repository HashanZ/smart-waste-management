import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

interface Config {
  nodeEnv: string;
  port: number;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  database: {
    mongodbUri: string;
    redisUrl: string;
  };
  mqtt: {
    brokerUrl: string;
    clientId: string;
    topicPrefix: string;
    username?: string | undefined;
    password?: string | undefined;
  };
  aws: {
    iotEndpoint: string;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  };
  ml: {
    serviceUrl: string;
  };
  email: {
    smtp: {
      host: string;
      port: number;
      user: string;
      pass: string;
    };
  };
  upload: {
    maxFileSize: number;
    path: string;
  };
  monitoring: {
    logLevel: string;
    enableMetrics: boolean;
  };
  logging: {
    level: string;
  };
  mobile: {
    fcmServerKey: string;
    fcmSenderId: string;
  };
}

const config: Config = {
  nodeEnv: process.env['NODE_ENV'] || 'development',
  port: parseInt(process.env['API_PORT'] || '3000', 10),
  cors: {
    // CORS origins: Frontend runs on 3001, backend on 3000
    // Frontend uses proxy to backend, but direct API calls may need CORS
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
    maxFileSize: parseInt(process.env['MAX_FILE_SIZE'] || '10485760', 10), // 10MB
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

// Validate required environment variables
const validateEnvironment = (): void => {
  const warnings: string[] = [];
  const errors: string[] = [];
  const requiredEnvVars: string[] = [];

  // Development mode validations
  if (config.nodeEnv === 'development') {
    // Warn about default JWT_SECRET
    if (process.env['JWT_SECRET'] === undefined || config.jwt.secret === 'your-super-secret-jwt-key-here') {
      warnings.push('⚠️  JWT_SECRET: Using default value. Set a strong JWT_SECRET in .env for security.');
    }

    // Warn about default MongoDB URI (local)
    if (config.database.mongodbUri.includes('localhost:27017')) {
      warnings.push('ℹ️  MONGODB_URI: Using local MongoDB. For production, use MongoDB Atlas.');
    }

    // Warn if ML service URL is not set
    if (!process.env['ML_SERVICE_URL']) {
      warnings.push('ℹ️  ML_SERVICE_URL: Using default (http://localhost:8888). Verify ML service is running.');
    }
  }

  // Production mode validations
  if (config.nodeEnv === 'production') {
    // JWT_SECRET is required in production
    if (!process.env['JWT_SECRET'] || config.jwt.secret === 'your-super-secret-jwt-key-here') {
      requiredEnvVars.push('JWT_SECRET');
    }

    // MongoDB URI must be set (not localhost)
    if (config.database.mongodbUri.includes('localhost:27017')) {
      errors.push('MONGODB_URI: Cannot use localhost in production. Use MongoDB Atlas connection string.');
    }

    // AWS IoT configuration (optional but recommended)
    if (!process.env['AWS_IOT_ENDPOINT']) {
      warnings.push('⚠️  AWS_IOT_ENDPOINT: Not set. IoT features may not work.');
    }

    // Email configuration (optional but recommended)
    if (!process.env['SMTP_USER'] || !process.env['SMTP_PASS']) {
      warnings.push('ℹ️  SMTP configuration: Not set. Email notifications will not work.');
    }
  }

  // Validate JWT_SECRET strength if set
  if (process.env['JWT_SECRET'] && config.jwt.secret.length < 32) {
    warnings.push('⚠️  JWT_SECRET: Should be at least 32 characters long for security.');
  }

  // Validate MongoDB URI format
  if (config.database.mongodbUri && !config.database.mongodbUri.startsWith('mongodb://') && !config.database.mongodbUri.startsWith('mongodb+srv://')) {
    errors.push('MONGODB_URI: Invalid format. Must start with mongodb:// or mongodb+srv://');
  }

  // Validate ML service URL format
  if (config.ml.serviceUrl && !config.ml.serviceUrl.startsWith('http://') && !config.ml.serviceUrl.startsWith('https://')) {
    errors.push('ML_SERVICE_URL: Invalid format. Must start with http:// or https://');
  }

  // Display warnings
  if (warnings.length > 0) {
    console.warn('\n📋 Environment Configuration Warnings:');
    warnings.forEach(warning => console.warn(`  ${warning}`));
    console.warn('');
  }

  // Check for missing required variables
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missingEnvVars.length > 0) {
    errors.push(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  }

  // Throw errors if any
  if (errors.length > 0) {
    console.error('\n❌ Environment Configuration Errors:');
    errors.forEach(error => console.error(`  ${error}`));
    console.error('');
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }

  // Success message in development
  if (config.nodeEnv === 'development' && warnings.length === 0) {
    console.log('✅ Environment configuration validated successfully');
  }
};

// Run validation
validateEnvironment();

export { config };
