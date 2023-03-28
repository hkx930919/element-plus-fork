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
