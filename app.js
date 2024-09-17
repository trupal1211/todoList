const express = require('express')
const ejs = require('ejs')
const app = express()
const bodyParser = require('body-parser')

app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({ extended: true }))

const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

const session = require('express-session')
const mongoDbSesion = require('connect-mongodb-session')(session)

mongoose.connect('mongodb+srv://trupal12:godhat11@cluster0.rclck10.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0').then(() => {
    console.log('connection successful')
}).catch((e) => {
    console.log("exception ", e)
})

const todoSchema = new mongoose.Schema({
    title: { type: String, required: true },
    addBy: { type: String }
})

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    apikey: { type: Number, unique: true },
    role: { type: Number, default: 0 },
    isPublic : {type:Boolean , default:false}
})

//models
const Users = mongoose.model('users', userSchema)
const Todos = mongoose.model('latest todo data', todoSchema)

//sessions
const store = new mongoDbSesion({
    uri: 'mongodb+srv://trupal12:godhat11@cluster0.rclck10.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0',
    collection: 'sessions'
})

app.use(session({
    secret: 'this is Top Secret',
    resave: false,
    saveUninitialized: false,
    store: store
}))

//middleware

let authMiddleware = (req, res, next) => {
    if (req.session.isAuth == true) {
        next()
    }
    else {
        res.redirect('/login')
    }
}

let adminMiddleware = (req, res, next) => {
    if (req.session.isAdmin == true) {
        next()
    }
    else {
        res.redirect('/login')
    }
}

// server

app.listen(1211, () => {
    console.log('server is running on port no 1211')
})

app.get('/', (req, res) => {
    res.render('welcome')
})

app.get('/login', (req, res) => {
    res.render('login')
})

app.get('/register', (req, res) => {
    res.render('register')
})

app.get('/todo', authMiddleware, async (req, res) => {
    let todos = await Todos.find({ addBy: req.session.user.email })
    res.render('todo', { todos: todos, name: req.session.user.name })
})

app.get('/do-logout', (req, res) => {
    req.session.destroy()
    res.redirect('/')
})

app.post('/add-user', async (req, res) => {

    let { name, email, password } = req.body

    let data = new Users({
        name: name,
        email: email,
        password: password
    })

    data.save()

    res.redirect('/login')
})


app.post('/auth', async (req, res) => {

    let { email, password } = req.body
    let isPasswordMatch = 0

    let currUser = await Users.findOne({ email: email })

    if (currUser) {
        isPasswordMatch = currUser.password == password ? true : false
    }
    else {
        res.redirect('/login')
    }

    if (isPasswordMatch) {
        req.session.isAuth = true
        req.session.user = currUser

        req.session.save((err) => {
            if (err) {
                console.error("Session save error: ", err);
                return res.redirect('/login');
            }
            else if (currUser.role == 1) {
                req.session.isAdmin = true
                res.redirect('/dashboard')
            }
            else {
                res.redirect('/todo')
            }
        })

    }
})

app.get('/dashboard', adminMiddleware, async (req, res) => {

    let normalUser = await Users.find({ role: 0 })
    res.render('adminDashboard', { users: normalUser, name: req.session.user.name })
})

app.post('/delete-user', async (req, res) => {

    let delEmail = req.body.delEmail
    let x = await Users.deleteOne({ email: delEmail })
    let y = await Todos.deleteMany({ addBy: delEmail })
    res.redirect('/dashboard')
})


app.post('/add-task', (req, res) => {

    let currTodo = req.body.todo

    if (currTodo) {
        let data = new Todos({
            title: currTodo,
            addBy: req.session.user.email
        })
        data.save()
    }

    res.redirect("/todo")
})

// api route

app.get('/api/users', async (req, res) => {
    let users = await Users.find({ role: 0 })
    res.json(users)
})

app.get('/api/user/:email', async (req, res) => {

    let userEmail = req.params.email
    let user = await Users.find({ role: 0, email: userEmail })
    if (user.length != 0) {
        res.json(user)
    }
    else {
        res.json('user dose not exist')
    }
})

app.get('/api/todo/:apikey', async (req, res) => {

    let key = req.params.apikey
    let user = await Users.find({ apikey: key, role: 0 })

    if (user.length == 0) {
        res.json('api is not authorized')
    }
    else {
        let todos = await Todos.find({ addBy: user[0].email })

        if (todos.length > 0) {
            res.json(todos)
        }
        else {
            res.json('No todos Created !!')
        }
    }

})

app.get('/api-access',async(req,res)=>{

    let user = await Users.findOne({email:req.session.user.email})
    res.render('apiAccess',{user:user})

    // res.render('apiAccess',{user:req.session.user})   na chale ? vicharo
})

app.get('/generate-api', async(req,res)=>{
    
    let key = Math.floor(Math.random()*1000000)
    let user = await Users.findOne({email:req.session.user.email})
    // console.log(user)

    user.apikey = key
    await user.save()

    res.redirect('/api-access')
})


// delete task

app.post('/delete-todo/:id',async(req,res)=>{

    let id = req.params.id

    await Todos.deleteOne({ _id:id })
    res.redirect('/todo')

})


// public route

app.get('/publicAcc' , authMiddleware ,async(req,res)=>{

    let public_acc = await Users.find({isPublic:true}) 

    res.render('publicAcc',{ public_acc : public_acc })
})

app.get('/publicAcc/:email',async(req,res)=>{

    let currEmail = req.params.email
    
    let user = await Users.findOne({email:currEmail})
    let public_todos = await Todos.find({addBy:currEmail})

    res.render('publicTodo' , {todo : public_todos , name : user.name })
})
