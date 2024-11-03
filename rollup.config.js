import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonJs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import dotenv from 'dotenv';
// import cleaner from 'rollup-plugin-cleaner';
dotenv.config();

export default {
  input: 'src/index.ts',
  output: {
    sourcemap: true,
    format: 'cjs',
    name: 'acDebugComponent',
    file: 'dist/subsonic-playlist-export.js',
  },
  plugins: [
    resolve(),
    typescript({useTsconfigDeclarationDir: true}),
    json(),
    commonJs({
      include: /node_modules/,
    }),
  ],
  preserveEntrySignatures: 'strict',
};
