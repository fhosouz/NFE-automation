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
    // the variable used by the code is ML_REDIRECT_URI; some deploys (e.g.
    // Render) might have inadvertently named it ML_URL_REDIRECT, so support
    // both. Warn if the alias is used in case the canonical name is changed
    // later.
    redirectUri: (() => {
      const canonical = process.env['ML_REDIRECT_URI'];
      const alias = process.env['ML_URL_REDIRECT'];
      if (alias && !canonical) {
        console.warn(
          '[CONFIG] using ML_URL_REDIRECT as fallback for ML_REDIRECT_URI'
        );
      }
      return canonical || alias || '';
    })(),
  },
};

export default config;
