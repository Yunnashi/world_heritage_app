const express = require("express");
const mongoose = require("mongoose");
const ejsMate = require("ejs-mate");
const { todoSchema } = require("./schemas");
const AppError = require("./utills/AppError");
const catchAsync = require("./utills/catchAsync");
const session = require("express-session");
const PORT = 3000;

const app = express();
const path = require("path");
const methodOverride = require("method-override");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.engine("ejs", ejsMate);

const sessionConfig = {
  secret: "mysecret",
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
};
app.use(session(sessionConfig));

const validateTodo = (req, res, next) => {
  const { error } = todoSchema.validate(req.body);
  if (error) {
    const msg = error.details.map((detail) => detail.message).join(",");
    throw new AppError(msg, 400);
  } else {
    next();
  }
};

// Connect to MongoDB
mongoose
  .connect("mongodb://mongo:27017/docker-node-mongo", {
    useNewUrlParser: true,
    userUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

const Todo = require("./models/todo");
const categories = ["なし", "低", "中", "高"];

app.get(
  "/todos",
  catchAsync(async (req, res) => {
    const { category } = req.query;
    if (category) {
      const todos = await Todo.find({ category });
      res.render("todos/index", { todos });
    } else {
      const todos = await Todo.find({});
      res.render("todos/index", { todos });
    }
  })
);

app.get("/todos/new", (req, res) => {
  res.render("todos/new", { categories });
});

app.post(
  "/todos",
  validateTodo,
  catchAsync(async (req, res) => {
    const newTodo = new Todo(req.body);
    await newTodo.save();
    console.log(newTodo);
    res.redirect(`/todos/${newTodo._id}`);
  })
);

app.get(
  "/todos/:id",
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const todo = await Todo.findById(id);
    if (!todo) {
      throw new AppError("ToDoが見つかりません", 404);
    }
    res.render("todos/show", { todo });
  })
);

app.get(
  "/todos/:id/edit",
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const todo = await Todo.findById(id);
    if (!todo) {
      throw new AppError("ToDoが見つかりません", 404);
    }
    res.render("todos/edit", { todo, categories });
  })
);

app.put(
  "/todos/:id",
  validateTodo,
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const todo = await Todo.findByIdAndUpdate(id, req.body, {
      runValidators: true,
      new: true,
    });
    res.redirect(`/todos/${todo._id}`);
  })
);

app.delete(
  "/todos/:id",
  catchAsync(async (req, res) => {
    const { id } = req.params;
    await Todo.findByIdAndDelete(id);
    res.redirect("/todos");
  })
);

app.all("*", (req, res, next) => {
  next(new AppError("ページが見つかりませんでした。", 404));
});

// カスタムエラーハンドラ
app.use((err, req, res, next) => {
  const { status = 500 } = err;
  if (!err.message) {
    err.message = "問題が発生しました";
  }
  res.status(status).render("error", { err });
});

app.listen(PORT, () => {
  console.log(`リクエストをポート${PORT}で待機中...`);
});
