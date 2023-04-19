1. `computed`返回一个值为ref时，需要将那个值`unref`

```js
// use-global-config 获取配置信息时就是先`unref`再返回值
  const context = computed(() => {
    const cfg = unref(config)
    if (!oldConfig?.value) return cfg
    return mergeConfig(oldConfig.value, cfg)
  })
```

2. `app.provide`和组件内的`provide`提供的`key`重名的话，会用到最近一层的`provide`,且`provide`必须在`setup`中调用

```js
  const inSetup = !!getCurrentInstance()
  // provide和inject必须在setup中同步调用
  const oldConfig = inSetup ? useGlobalConfig() : undefined
    
  const provideFn = app?.provide ?? (inSetup ? provide : undefined)
```

3. 匹配汉字

```js
// 汉字
/\p{Unified_Ideograph}/u

```

```js
// 两个汉字
/^\p{Unified_Ideograph}{2}$/u
```

4. `vite`里可以使用`import.meta.glob`去匹配文件，默认是懒加载的，通过动态导入实现，并会在构建时分离为独立的 chunk。如果直接引入所有的模块，可以使用`import.meta.globEager`

```js
  const apps = import.meta.glob('./src/*.vue')
  const name = location.pathname.replace(/^\//, '') || 'App'
  const file = apps[`./src/${name}.vue`]
  const App = (await file()).default // 调用动态导入函数后拿到default内容，如果直接引入时，可以直接拿file.default
  const app = createApp(App,)
```

5. 使用`useProp`拿到组件的`prop`

```ts
export const useProp = <T>(name: string): ComputedRef<T | undefined> => {
  const vm = getCurrentInstance() // 根据getCurrentInstance拿到组件上下文
  return computed(() => (vm?.proxy?.$props as any)?.[name])
}

```

6. 使用`ResizeObserver`来监听元素的大小更改，并且每次大小更改时都会向观察者传递通知

>`ResizeObserver`与`IntersectionObserver`有点类似，不过`IntersectionObserver`是用来检测目标元素与祖先元素或 `viewport` 相交情况变化的方法

```js
/*************** resizeObserver ****************/
// 1. 设置监测回调，并初始化一个监听
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    if(entry.contentBoxSize) {
      h1Elem.style.fontSize = `${Math.max(1.5, entry.contentBoxSize.inlineSize / 200)}rem`;
      pElem.style.fontSize = `${Math.max(1, entry.contentBoxSize.inlineSize / 600)}rem`;
    } else {
      h1Elem.style.fontSize = `${Math.max(1.5, entry.contentRect.width / 200)}rem`;
      pElem.style.fontSize = `${Math.max(1, entry.contentRect.width / 600)}rem`;
    }
  }
});
// 2. 监听某个元素
resizeObserver.observe(divElem);
// 3. 对某个元素取消监听
resizeObserver.unobserve(divElem);
// 4. 取消所有元素的监听
resizeObserver.disconnect(divElem);

/*************** IntersectionObserver ****************/
const options = {
  root: document.querySelector('#scrollArea'),
  rootMargin: '0px',
  threshold: 1.0
}

const observer = new IntersectionObserver(callback, options);
// 2. 监听某个元素
resizeObserver.observe(divElem);
// 3. 对某个元素取消监听
resizeObserver.unobserve(divElem);
// 4. 取消所有元素的监听
resizeObserver.disconnect(divElem);
```

7. `getCurrentScope`与`onScopeDispose`用于作为可复用的组合式函数中 onUnmounted 的替代品，它并不与组件耦合，因为每一个 Vue 组件的 setup() 函数也是在一个 effect 作用域中调用的。
比如事件监听等需要销毁的api需要在`onScopeDispose`中调用

```js
/**
 * Call onScopeDispose() if it's inside an effect scope lifecycle, if not, do nothing
 *
 * @param fn
 */
export function tryOnScopeDispose(fn: Fn) {
  if (getCurrentScope()) {
    onScopeDispose(fn)
    return true
  }
  return false
}
/**
 * Reports changes to the dimensions of an Element's content or the border-box
 *
 * @see https://vueuse.org/useResizeObserver
 * @param target
 * @param callback
 * @param options
 */
export function useResizeObserver(
  target: MaybeComputedElementRef | MaybeComputedElementRef[],
  callback: ResizeObserverCallback,
  options: UseResizeObserverOptions = {},
) {
  const { window = defaultWindow, ...observerOptions } = options
  let observer: ResizeObserver | undefined
  const isSupported = useSupported(() => window && 'ResizeObserver' in window)

  const cleanup = () => {
    if (observer) {
      observer.disconnect()
      observer = undefined
    }
  }

  const targets = computed(() =>
    Array.isArray(target)
      ? target.map(el => unrefElement(el))
      : [unrefElement(target)],
  )

  const stopWatch = watch(
    targets,
    (els) => {
      cleanup()
      if (isSupported.value && window) {
        observer = new ResizeObserver(callback)
        for (const _el of els)
          _el && observer!.observe(_el, observerOptions)
      }
    },
    { immediate: true, flush: 'post', deep: true },
  )

  const stop = () => {
    cleanup()
    stopWatch()
  }
// 使用onScopeDispose销毁掉observer的监听和取消watch
  tryOnScopeDispose(stop)

  return {
    isSupported,
    stop,
  }
}
```

# sass 使用

1. `@use`导入文件
新的@use 类似于@import。但有一些明显的区别:

```scss
@use 'buttons';ons';
```

- 该文件只导入一次，不管在项目中@use它多少次。
- 以下划线(_)或连字符(-)开头的变量、mixin 和函数(Sass称为"成员变量")被认为是私有的，不会被导入。
- 导入的文件（这里即buttons.scss）中的成员变量只在局部可用，而不会传递到未来的导入结果中。
- 所有导入的成员变量默认拥有命名空间

当我们@use 一个文件时，Sass会根据文件名自动生成一个命名空间:

```scss
@use 'buttons'; // 生成了一个`buttons` 命名空间
@use 'forms'; // 生成了一个 `forms` 命名空间
```

```scss
我们可以在导入时添加as <name>来改变或删除默认的命名空间：

@use 'buttons' as *; // 星号会删除所有命名空间
@use 'forms' as 'f';
$btn-color: $color; // 不带命名空间的buttons.$color
$form-border: f.$input-border; // 带有自定义命名空间的forms.$input-border
```

**导入内置的Sass模块**
内部的Sass特性也已经转移到模块系统中，因此我们可以完全控制全局命名空间。有几个内置的模块：`math, color, string, list, map, selector和meta` ，这些模块必须在使用之前显式地导入到文件中:

```scss
@use 'sass:math';
$half: math.percentage(1/2);
```

**可配置项**
样式表可以使用 `!default` 标志定义变量以使它们可配置。要加载带有配置的模块，需使用`@use <url> with (<variable>: <value>, <variable>: <value>)`。配置的值将覆盖变量的默认值。

```scss
// _library.scss
$black: #000 !default;
$border-radius: 0.25rem !default;
$box-shadow: 0 0.5rem 1rem rgba($black, 0.15) !default;

code {
  border-radius: $border-radius;
  box-shadow: $box-shadow;
}
```

```scss
// style.scss
@use 'library' with (
  $black: #222,
  $border-radius: 0.1rem
);
```

```scss
code {
  border-radius: 0.1rem;
  box-shadow: 0 0.5rem 1rem rgba(34, 34, 34, 0.15);
}
```

2. 用`@forward`传递文件

我们并不总是需要使用一个文件，并访问它的成员。有时我们只是想把它传给未来的导入操作。假设我们有多个与表单相关的partials，
我们希望将它们全部导入为一个命名空间。我们可以用 `@forward`来实现：

```scss
// forms/_index.scss
@forward 'input';
@forward 'textarea';
@forward 'select';
@forward 'buttons';
```

**被转发的文件的成员在当前文档中不可访问，也没有创建命名空间，但是当另一个文件想要@use 或@forward 整个集合时，这些变量、函数和mixin 就是可访问的。如果转发的部分包含实际的CSS，那么在使用包之前，它也不会生成输出。**

```scss
// styles.scss
@use 'forms'; // 导入`forms` 命名空间下的所有被转发的成员
```

>如果你要求Sass导入一个目录，它会寻找一个名为index或_index的文件

默认情况下，所有公共成员将使用一个模块进行转发。但我们可以更有选择性地添加`show` 或`hide`语句，来包含或排除指定的成员

```scss
// 只转发'input' 中的 border() mixin 和 $border-color 变量
@forward 'input' show border, $border-color;

// 转发'buttons' 里的所有成员， gradient() 函数除外
@forward 'buttons' hide gradient;
```

>当函数和mixin共享一个名称时，它们会一起显示和隐藏。

为了区分来源，或避免转发模块之间的命名冲突，我们可以在转发时对模块成员使用as 前缀：

```scss
// forms/_index.scss
// @forward "<url>" as <prefix>-*;
// 假设两个模块都有一个background() mixin
@forward 'input' as input-*;
@forward 'buttons' as btn-*;

// style.scss
@use 'forms';
@include forms.input-background();
@include forms.btn-background();
```

# `vue-cli`和`vite`构建多入口`lib`
>
>构建多入口的核心在于`entry`的多入口
>
### vue-cli构建

```js
// vue.config.js
const { resolve, getComponentEntries } = require('./utils')
const pub = require('./config.pub')

module.exports = {
  outputDir: resolve('lib'),
  configureWebpack: {
    entry: {
      ...getComponentEntries('packages') // 获取多入口文件
    },
    output: {
      filename: '[name]/index.js', // 每个入口获取
      libraryTarget: 'umd', 
      library: 'aital-plugin-paper-mark',
      umdNamedDefine: true,
      globalObject: 'this'
    },
    resolve: pub.resolve
  },
  css: {
    sourceMap: true,
    extract: {
      filename: '[name]/style.css' // css build进对应的目录
    }
  },
}

```

### vite构建
>
>`vite`打包`lib`不支持多入口，只能通过api手动打包

```js
// buildModules.js
import { build } from 'vite'
import glob from 'fast-glob'
import vue from '@vitejs/plugin-vue'
// 获取入口
const input = glob.sync('./src/packages/*/index.ts', {
  absolute: true,
  onlyFiles: true,
})
const librarys = input.map((entry) => {
    const [,name]=/src\/packages\/(.+)\/index\.ts$/.exec(entry)
    return {
      entry,
      name,
      fileName: (format) => `packages/${name}/index.${format}.js` // 打包后的文件名
    };
  });
librarys.forEach(async (lib) => {
    await build({
      configFile: false,
      sourcemap: true,
      build: {
        lib,
        assetsDir: "",
        emptyOutDir: false,
        rollupOptions: {
            external: ['vue'],
            output: {
                // 在 UMD 构建模式下为这些外部化的依赖提供一个全局变量
                globals: {
                  vue: 'Vue',
                },
                assetFileNames(assetInfo){
                    return `packages/${lib.name}/${assetInfo.name}` // 配置css等资源路径
                }
              }
        },
      },
      plugins: [vue()],
    });
  });
```
