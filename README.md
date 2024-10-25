# webpack-weapp-dynamic-import

在 webpack 构建中，将 `import('xxx')` 转换成小程序的异步引入 `require.async('yyy')`

## 使用方式
### 在 taro 中的使用方式
1. 在`src`目录中，建立 `async-` 开头的分包，比如 `async-components`，然后在里面写组件或者逻辑并导出

2. 在 `app.config.ts` 里面将这个分包进行注册， `pages` 给空数组即可

3. 可以在 webpackChain 中添加该插件
```js
import WeappDynamicImportPlugin from 'webpack-weapp-dynamic-import';

export default defineConfig(async (merge, { command, mode }) => {
  const baseConfig = {
    mini: {
      webpackChain(chain) {
        // 添加自定义插件支持
        chain.plugin('dynamic-import').use(WeappDynamicImportPlugin);

        // 如果要将部分 npm 包也进行异步化加载，可以自行添加 cacheGroups 处理逻辑
        // 分组名也要以 async- 开头才会使用 require.async 加载
        // 记得分组名要在 app.config.ts 中也注册一下
        chain.optimization.merge({
          splitChunks: {
            cacheGroups: {
              vendors: {
                test: /[\\/]node_modules[\\/]/,
                name(module) {
                  // 如果是 crypto-js，则打入分包 async-a 中
                  if (/node_modules[\\/]crypto-js/.test(module.resource)) {
                    return 'async-a/crypto-js';
                  }
                  // 默认的分组名
                  return 'vendors'
                },
              },
            },
          }
        })
      }
    }
  }
})
```

* 注意
1. 由于只是转换成 `require.async`，所以在异步分包中写的组件，实际上就是单个 js 文件，不是小程序的组件类型(js、json、wxml、wxss)，如果要使用样式的话，推荐`Tailwind CSS`、全局样式、或者直接写 style

2. taro默认是将`import()`转换成了`require`，所以必须在`babel.config.js`中将`dynamic-import-node`改为`false`，具体可参考`https://taro-docs.jd.com/docs/dynamic-import`

3. 如果你将一个 npm 包放到了 异步分包 A 里面，那其它分包(包括主包)在引入它的时候，最好要使用 import('xxx') 的语法，否则可能会白屏，并且也不会报错，异步分包 A 内部用同步导入或异步导入都行
