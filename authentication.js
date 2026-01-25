import db from './firebaseConfig.js'
import showErrorMessage from './script.js'
let username = document.querySelector('.username')
let loginBtn = document.querySelector('.loginBtn')
let authScreen = document.querySelector('.authScreen')
let loginFormBtn = document.querySelector('.loginFormBtn')
let registerFormBtn = document.querySelector('.registerFormBtn')

let action = 'register'

loginBtn.onclick = () => authenticate()
registerFormBtn.style.transform = 'translateY(-6px)'
username.placeholder = 'Enter a unique username....'
registerFormBtn.onclick = () => {
    action = 'register'
    registerFormBtn.style.background = '#d9534f'
    registerFormBtn.style.transform = 'translateY(-6px)'
    loginFormBtn.style.transform = 'translateY(0px)'
    loginBtn.style.background = '#d9534f'
    loginBtn.textContent = 'Register'
    username.placeholder = 'Enter a unique username....'
}
loginFormBtn.onclick = () => {
    action = 'login'
    loginFormBtn.style.background = '#627ebc'
    loginFormBtn.style.transform = 'translateY(-6px)'
    registerFormBtn.style.transform = 'translateY(0px)'
    loginBtn.style.background = '#627ebc'
    loginBtn.textContent = 'Login'
    username.placeholder = 'Enter username to login....'
}

function checkLogin() {
    db.collection("users").get().then((snap) => {
        let localUname = JSON.parse(localStorage.getItem("user") || '{}').username || null
        const user = snap.docs.find((doc) => localUname === doc.data().user) || null
        let localUID = JSON.parse(localStorage.getItem("user") || '{}').id || null
        if (user === null) return
        if (user.id === localUID) {
            authScreen.style.display = 'none'
            // location.reload()
        } else {
            authScreen.style.display = 'block'
        }
    })
}

function authenticate() {
    if (action === 'login') {
        db.collection("users").get().then((snap) => {
            const user = snap.docs.find((doc) => username.value === doc.data().user)
            if (user) {
                localStorage.setItem("user", JSON.stringify({ username: user.data().user, id: user.id }))
                authScreen.style.display = 'none'
                location.reload()
            } else {
                showErrorMessage("User not found")
            }
        })
    } else if (action === 'register') {
        db.collection("users").get().then((snap) => {
            const user = snap.docs.find((doc) => username.value === doc.data().user)
            if (user) {
                showErrorMessage("User already exists")
                return
            } else {
                db.collection("users").add({ user: username.value }).then((snap) => {
                    localStorage.setItem("user", JSON.stringify({ username: username.value, id: snap.id }))
                }).then(() => {
                    location.reload()
                })
                authScreen.style.display = 'none'
            }
        })
    }
}

checkLogin()