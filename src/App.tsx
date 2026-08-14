import { AppRouter } from "./router/AppRouter";
import { BackgroundProvider } from "./context/BackgroundProvider";
import { BackgroundLayer } from "./components/common/BackgroundLayer";

function App() {
  return (
    <BackgroundProvider>
      <BackgroundLayer />
      <AppRouter />
    </BackgroundProvider>
  );
}

export default App;
