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

const getOptionalEnv = (key: string): string | undefined => {
  const value = process.env[key];
  if (!value) {
    console.warn(`[CONFIG] Optional environment variable not set: ${key}`);
    return undefined;
  }
  return value;
};

const config: Config = {
  supabase: {
    url: getRequiredEnv('SUPABASE_URL'),
    // anon key is optional on server-side; service role key is required
    anonKey: getOptionalEnv('SUPABASE_ANON_KEY') || '',
    serviceRoleKey: getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  },
  app: {
    env: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
  },
  mercadoLivre: {
    clientId: getOptionalEnv('ML_CLIENT_ID') || '',
    clientSecret: getOptionalEnv('ML_CLIENT_SECRET') || '',
    redirectUri: getOptionalEnv('ML_REDIRECT_URI') || '',
  },
};

export default config;
