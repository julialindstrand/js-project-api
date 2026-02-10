import cors from "cors"
import express from "express"
import mongoose from "mongoose"
import "dotenv/config"
import listEndpoints from "express-list-endpoints"
import thoughtData from "./data.json" with { type: "json" }
import thoughtRoutes from "./routes/thoughtRoutes.js"
import userRoutes from "./routes/userRoutes.js"

const mongoUrl = process.env.MONGO_URL
mongoose.connect(mongoUrl)
mongoose.Promise = Promise

if (process.env.RESET_DB === "true") {
  const seedDatabase = async () => {
    await Thought.deleteMany()
    thoughtData.forEach((thought) => {
      new Thought(thought).save()
    })
  }

  console.log("seeding database")
  await seedDatabase()

  const app = express()

  app.use(cors())
  app.use(express.json())

  // Shows all endpoints
  app.get("/", (req, res) => {
    const endpoints = listEndpoints(app)
    res.json({
      message: "Welcome to the happy thoughts API. Here is a list of all endpoints",
      endpoints: endpoints,
    })
  })

  app.use("/thoughts", thoughtRoutes)
  app.use("/users", userRoutes)

  const port = process.env.PORT || 8080
  // Start the server
  app.listen(port, () => {
    // console.log(`Server running on http://localhost:${port}`)
  })
}