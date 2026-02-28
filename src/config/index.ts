/**
 * Environment Configuration
 * Centralizes all environment variables and configuration settings
 */

interface Config {
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
  app: {
    env: 'development' | 'production' | 'test';
    port: number;
  };
  mercadoLivre: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
}

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const config: Config = {
  supabase: {
    url: getRequiredEnv('SUPABASE_URL'),
    anonKey: getRequiredEnv('SUPABASE_ANON_KEY'),
    serviceRoleKey: getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  },
  app: {
    env: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
  },
  mercadoLivre: {
    clientId: getRequiredEnv('ML_CLIENT_ID'),
    clientSecret: getRequiredEnv('ML_CLIENT_SECRET'),
    redirectUri: getRequiredEnv('ML_REDIRECT_URI'),
  },
};

export default config;
