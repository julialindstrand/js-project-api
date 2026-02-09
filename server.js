import cors from "cors"
import express from "express"
import mongoose from "mongoose"
import "dotenv/config"
import listEndpoints from "express-list-endpoints"
import thoughtData from "./data.json" with { type: "json" }

const mongoURL = process.env.MONGO_URL || "mongodb://localhost/thoughts"
mongoose.connect(mongoURL).catch(error => console.error("Mongo connection error:", error))

if (process.env.RESET_DB === "true") {
  const seedDatabase = async () => {
    await Thought.deleteMany()
    thoughtData.forEach((thought) => {
      new Thought(thought).save()
    })
  }

  console.log("seeding database")
  seedDatabase()
}

// Defines the port the app will run on. Defaults to 8080, but can be overridden
// when starting the server. Example command to overwrite PORT env variable value:
// PORT=9000 npm start
const port = process.env.PORT || 8080
const app = express()

// Add middlewares to enable cors and json body parsing
app.use(cors())
app.use(express.json())

// Thought schema
const thoughtSchema = new mongoose.Schema({
  message: { type: String, required: true },
  hearts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
  // userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
})

const Thought = mongoose.model('Thought', thoughtSchema)

// User schema
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  accessToken: { type: String }
})

const User = mongoose.model('User', UserSchema)

const authenticateUser = async (req, res, next) => {
  try {
    const user = await User.findOne({
      accessToken: req.header('Authorization').replace("Bearer ", ""),
    })
    if (user) {
      req.user = user
      next()
    } else {
      res.status(401).json({
        message: "Authentication missing / invalid",
        loggedOut: true
      })
    }
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error: error.message })
  }
}

// Start defining your routes here

// All
app.get("/", (req, res) => {
  const endpoints = listEndpoints(app)
  res.json({
    message: "Welcome to the happy thoughts API. Here is a list of all endpoints",
    endpoints: endpoints,
  })
})

// New User
app.post('/users/signup', async (req, res) => {
  try {
    const { email, password } = req.body

    const existingUser = await User.findOne({
      email: email.toLowerCase()
    })

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists"
      })
    }

    const salt = bcrypt.genSaltSync()
    const hashedPassword = bcrypt.hashSync(password, salt)
    const user = new User({ email, password: hashedPassword })

    await user.save()

    res.status(200).json({
      success: true,
      message: "User created successfully",
      response: {
        email: user.email,
        id: user._id,
        accessToken: user.accessToken,
      },
    })
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Could not create user',
      response: error,
    })
  }
})

// Sign In
app.post('/users/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email: email.toLowerCase() })

    if (user && bcrypt.compareSync(password, user.password)) {
      res.json({
        success: true,
        message: "Logged in successfully",
        response: {
          email: user.email,
          id: user._id,
          accessToken: user.accessToken
        },
      })
    } else {
      res.status(401).json({
        success: false,
        message: "Wrong e-mail or password",
        response: null,
      })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Something went wrong",
      response: error
    })
  }
})

// Show all thoughts
app.get("/thoughts", async (req, res) => {
  try {
    const thoughts = await Thought.find().sort({ createdAt: "desc" })
    res.json(thoughts)

  } catch (error) {
    res.status(500).json({ error: "Failed to fetch thougts" })
  }
})

// Show thoughts with likes
app.get("/thoughts/likes", async (req, res) => {
  const { hearts } = req.query

  const dbQuery = {}
  if (hearts !== undefined) {
    const heartsNum = Number(hearts)
    if (!Number.isNaN(heartsNum)) {
      dbQuery.hearts = heartsNum
    }
  }

  try {
    const thoughts = await Thought.find(dbQuery)
    if (thoughts.length === 0) {
      return res.status(404).json({
        success: false,
        response: [],
        message: "No thoughts match the query"
      })
    }

    return res.status(200).json({
      success: true,
      response: thoughts,
      message: "Thoughts retrieved"
    })
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      response: [],
      message: error
    })
  }
})

// Filter by ID
app.get("/thoughts/:id", async (req, res) => {
  const id = req.params.id

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        response: null,
        message: "Invalid ID format",

      })
    }
    const thought = await Thought.findById(id)

    if (!thought) {
      return res.status(404).json({
        success: false,
        response: null,
        message: "Thought not found",
      })
    }

    return res.status(200).json({
      success: true,
      response: thought,
      message: "Success",
    })
  }

  catch (error) {
    return res.status(500).json({
      success: false,
      response: null,
      message: error,
    })
  }
}
)

// Post
app.post("/thoughts", async (req, res) => {
  const { message } = req.body

  try {
    const newThought = await new Thought({ message }).save()

    if (!newThought) {
      return res.status(400).json({
        success: false,
        data: null,
        message: "Failed to post thought"
      })
    }

    res.status(201).json({
      success: true,
      data: newThought,
      message: "Thought created successfully."
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: null,
      message: error.message || "Server error"
    })
  }
})

// Edit
app.patch('/messages/:id', async (req, res) => {
  try {
    const thought = await Thought.findById(req.params.id)

    if (!thought) {
      return res.status(404).json({ error: "Thought not found" })
    }

    if (thought.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "You can only edit your own thoughts" })
    }

    thought.thought = req.body.thought || thought.thought
    await thought.save()

    res.json(thought)
  } catch (error) {
    res.status(400).json({ error: "Invalid Id / request" })
  }
})


// Delete
app.delete("/thoughts/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const thought = await Thought.findById(id)

    if (!thought) {
      return res.status(404).json({
        success: false,
        response: [],
        message: "Thought not found"
      })
    }

    await Thought.findByIdAndDelete(id)

    res.status(200).json({
      success: true,
      response: id,
      message: "Thought deleted successfully"
    })

  } catch (error) {
    res.status(500).json({
      success: false,
      response: null,
      message: error,
    })
  }
})

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
