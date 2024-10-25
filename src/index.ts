import type { Compiler } from 'webpack';
import { RuntimeModule, RuntimeGlobals, Template } from 'webpack';
import { memoize } from 'lodash';

class AsyncRequireRuntimeModule extends RuntimeModule {
  constructor() {
    super('require.async');
  }

  generate(): string | null {
    const compilation = this.compilation!;
    const { runtimeTemplate } = compilation;
    const visitedChunks = new Set();
    return Template.asString([
      `${(RuntimeGlobals.loadScript)} = ${runtimeTemplate.basicFunction(
        `url, done, key, chunkId`,
        [
          'switch (String(chunkId)) {',
          compilation.chunkGroups.reduce((res, group) => {
            group.chunks.forEach((chunk) => {
              if (visitedChunks.has(chunk)) {
                return;
              }
              visitedChunks.add(chunk);
              if (chunk.canBeInitial()) {
                return;
              }
              const modulePath = `./${chunk.name || chunk.id}.js`;
              let statement: string;
              if (chunk.chunkReason?.includes('async-')) {
                statement = `require.async("${modulePath}").then(done, done);`;
              } else {
                statement = `try { require("${modulePath}"); done() } catch(e) { done(e) }`;
              }
              res += `  case "${chunk.id}": { ${statement} break; }\n`;
            });
            return res;
          }, ''),
          '  default: { require("./" + url + ".js"); done() }',
          '}',
        ],
      )};`,
    ]);
  }
}

const HOOK_NAME = 'WeappDynamicImportPlugin';

export default class WeappDynamicImportPlugin {
  apply(compiler: Compiler) {

    compiler.hooks.afterEnvironment.tap(HOOK_NAME, () => {
      const splitAsyncChunks = memoize((resource: string | null | undefined) => {
        if (resource == null) {
          return undefined;
        }

        resource = resource.replace(/\\/g, '/');

        // 异步分包
        const matchAsyncDeps = resource.match(/src\/(async-[^/]+)/);
        if (matchAsyncDeps) {
          return `${matchAsyncDeps[1]}/index`;
        }

        return undefined;
      });

      if (compiler.options.optimization.splitChunks) {
        compiler.options.optimization.splitChunks = {
          ...compiler.options.optimization.splitChunks,

          cacheGroups: {
            ...compiler.options.optimization.splitChunks.cacheGroups,

            __require_async: {
              enforce: true,
              test: (module: any) => {
                return !!splitAsyncChunks(module.resource);
              },
              name: (module: any) => {
                return splitAsyncChunks(module.resource);
              },
            },
          },
        };
      }
    });

    compiler.hooks.compilation.tap(HOOK_NAME, (compilation) => {
      compilation.hooks.runtimeRequirementInTree
        .for(RuntimeGlobals.loadScript)
        .tap({ name: HOOK_NAME, before: 'RuntimePlugin' }, (chunk) => {
          compilation.addRuntimeModule(
            chunk,
            new AsyncRequireRuntimeModule(),
          );
          return true;
        });
    });
  }
}
