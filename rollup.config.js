import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import {terser} from 'rollup-plugin-terser';
import run from '@rollup/plugin-run';
import dotenv from 'dotenv';
dotenv.config();

export default {
  input: 'src/index.ts',
  output: {
    sourcemap: true,
    format: 'iife',
    name: 'acDebugComponent',
    file: 'dist/subsonic-playlist-export.js',
  },
  plugins: [
    resolve(),
    terser({
      ecma: 2017,
      module: true,
      warnings: true,
    }),
    typescript({useTsconfigDeclarationDir: true}),
    run(),
  ],
  preserveEntrySignatures: 'strict',
};
