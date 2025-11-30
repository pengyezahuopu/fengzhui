import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { UserProvider } from './store/userStore.tsx'
import { ErrorBoundary } from './components/common'
import './app.scss'

function App({ children }: PropsWithChildren<any>) {

  useLaunch(() => {
    console.log('App launched.')
  })

  // children 是将要会渲染的页面
  // ErrorBoundary 包裹整个应用，捕获所有未处理的错误
  return (
    <ErrorBoundary>
      <UserProvider>
        {children}
      </UserProvider>
    </ErrorBoundary>
  )
}

export default App
