import { RouterProvider } from 'react-router-dom'
import router from './router'
import Background from './components/Background'
import ToastContainer from './components/ToastContainer'

function App(): React.JSX.Element {
  return (
    <>
      <Background />
      <ToastContainer />
      <RouterProvider router={router} />
    </>
  )
}

export default App
