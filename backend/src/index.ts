import { app } from "./app";
import { startDeadlineWatcher } from "./lib/deadlines";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`API escuchando en el puerto ${PORT}`);
  startDeadlineWatcher();
});
