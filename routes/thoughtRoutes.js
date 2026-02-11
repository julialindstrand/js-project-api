import express from "express"
import mongoose from "mongoose"
import { User } from "./userRoutes.js"

const router = express.Router();


// Thought schema
const thoughtSchema = new mongoose.Schema({
  message: { type: String, required: true },
  hearts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
})

const Thought = mongoose.model('Thought', thoughtSchema)


// Show all thoughts
router.get("/thoughts", async (req, res) => {
  gi
  try {
    const thoughts = await Thought.find().sort({ createdAt: "desc" })
    res.json(thoughts)

  } catch (error) {
    res.status(500).json({ error: "Failed to fetch thougts" })
  }
})


// Show thoughts with likes
router.get("/thoughts/:id/like", async (req, res) => {
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
router.get("/thoughts/:id", async (req, res) => {
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
router.post("/thoughts", async (req, res) => {
  await authenticateUser(req, res, next)
  const { message } = req.body

  try {
    const newThought = await new Thought({
      message, userId: req.user._id,
    }).save()

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
router.patch('/thoughts/:id', async (req, res) => {
  await authenticateUser(req, res, next)
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
router.delete("/thoughts/:id", async (req, res, next) => {
  await authenticateUser(req, res, next)
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

export default router

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