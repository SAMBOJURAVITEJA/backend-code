import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import jwt from "jsonwebtoken";

// Load environment variables from .env file
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const middleware = async (req, res, next) => {
  console.log("middleware called");

  let jwtToken;
  let authHeaders = req.headers["authorization"];
  if (authHeaders !== undefined) {
    console.log("invalid jwt token1");
    jwtToken = authHeaders.split(" ");
  }
  if (jwtToken === undefined) {
    console.log("invalid jwt token2");
    res.status(400).send("invalid jwt Token");
  } else {
    jwt.verify(jwtToken[1], "MY_SECRET_TOKEN", async (err, result) => {
      if (err) {
        console.log("invalid jwt token3");
        res.status(400).send("invalid jwt Token");
      } else {
        next();
      }
    });
  }
};

// Connect to MongoDB
mongoose
  .connect(process.env.mongoDbUrl)
  .then(() => console.log("MongoDB connected"))
  .catch((error) => {
    console.log("mongodb not connected");
    console.error("MongoDB connection error: ", error.message);
    process.exit(1);
  });

// Define Schemas and Models
const EmployeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  date: { type: Date, default: Date.now },
});
const Employee = mongoose.model("Employee", EmployeeSchema);

const KudosSchema = new mongoose.Schema({
  // id: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" }, // Assuming you meant this
  badge: { type: String, required: true },

  recipientId: { type: String, required: true },
  //  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" }, // Updated to ObjectId and reference Employee
  message: { type: String, required: true },
  date: { type: Date, default: Date.now },
});
const Kudos = mongoose.model("Kudos", KudosSchema);

app.get("/api/allEmployees", async (req, res) => {
  try {
    const newEmployee = await Employee.find();

    res.status(200).json(newEmployee);
  } catch (error) {
    console.error("Error in retrieving", error.message);
    res.status(500).send("Server Error");
  }
});

app.post("/api/addEmployeeSignUp", async (req, res) => {
  try {
    console.log(req.body);
    const { name, email } = req.body;
    const newEmployee = new Employee({ name, email });
    const employee = await newEmployee.save();
    console.log("employee added generated token");
    const token = jwt.sign({ email }, "MY_SECRET_TOKEN");
    res.status(200).json({ token });
  } catch (error) {
    console.error("Error in signup ", error.message);
    res.status(500).send("Server Error");
  }
});

app.post("/api/getEmployeeSignin", middleware, async (req, res) => {
  const { name, email } = req.body;

  try {
    const employees = await Employee.find({
      $and: [{ name: name }, { email: email }],
    }).select("-__v");
    if (employees.length === 0) {
      console.log("employees", employees);
      console.log("success in verifying");
      res.status(500).send(false);
    } else {
      console.log("employees", employees);
      console.log("success in verifying");
      res.status(200).send(true);
    }
  } catch (error) {
    console.error("Error in  verifying", error.message);
    res.status(500).send(false);
  }
});

app.post("/api/addKudos", async (req, res) => {
  console.log("api called");

  try {
    const { recipientId, message, badge } = req.body;

    // Assuming 'recipient' is an Employee ID
    const newKudo = new Kudos({ badge, recipientId, message });
    const kudo = await newKudo.save();
    console.log("kudos added successfully");
    res.status(200).send(true);
  } catch (error) {
    console.error("Error adding kudo:", error.message);
    res.status(500).send(false);
  }
});

app.get("/api/kudosCount", async (req, res) => {
  try {
    const data = await Kudos.aggregate([
      {
        $group: {
          _id: "$recipientId", // Group by recipientId
          totalCount: { $sum: 1 }, // Calculate the total number of kudos per recipient
        },
      },
      {
        $addFields: {
          recipientIdObjectId: { $toObjectId: "$_id" }, // Convert recipientId (string) to ObjectId
        },
      },
      {
        $lookup: {
          from: "employees", // Lookup from the employees collection
          localField: "recipientIdObjectId", // Match the converted ObjectId
          foreignField: "_id", // _id field in the employees collection
          as: "recipientDetails", // Store the resulting matched employee data in recipientDetails
        },
      },
      {
        $unwind: "$recipientDetails", // Unwind the recipientDetails array
      },
      {
        $project: {
          _id: 1, // Keep the recipientId
          totalCount: 1, // Keep the totalCount
          "recipientDetails.name": 1,
          // Include the recipient's name from the employees collection
        },
      },
    ]);
    console.log("Aggregated Data:");
    console.log(data); // Log the result of the aggregation
    res.status(200).send(data);
  } catch (err) {
    console.log("Error during aggregation:", err);
    res.status(500).send("Error occurred while aggregating");
  }
});

app.listen(process.env.PORT, () =>
  console.log(`Server running on port ${process.env.PORT}`)
);
