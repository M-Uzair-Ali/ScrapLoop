import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth";
import usersRoutes from "./routes/users";
import listingsRoutes from "./routes/listings";
import matchesRoutes from "./routes/matches";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "scraploop-backend" });
});

app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/listings", listingsRoutes);
app.use("/matches", matchesRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`ScrapLoop API listening on port ${PORT}`);
});
