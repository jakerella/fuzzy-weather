
module.exports = {
    sample: (a) => {
        if (!Array.isArray(a)) { return null }
        return a[Math.floor(Math.random() * a.length)]
    }
}
