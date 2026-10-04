import { createRoot } from "react-dom/client";
import { DeckList } from "./DeckList";

createRoot(document.getElementById("root")!).render(<DeckList profileId="p1" />);
