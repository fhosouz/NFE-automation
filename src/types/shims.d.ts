// Module shims for build environments that do not install @types packages
declare module 'express';
declare module 'cookie-parser';

// Allow importing other commonjs packages without types during CI builds
declare module '*';
