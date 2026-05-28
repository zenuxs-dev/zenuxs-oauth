const express = require('express');
const session = require('express-session');
const ZenuxOAuth = require('../../src');

const app = express();

app.use(session({
    secret: process.env.SESSION_SECRET || 'replace-me',
    resave: false,
    saveUninitialized: false
}));

const oauth = new ZenuxOAuth({
    clientId: process.env.ZENUX_CLIENT_ID,
    debug: true
});

app.get('/login', async (req, res, next) => {
    try {
        const tokens = await oauth.login({
            request: req,
            response: res
        });

        // First hit: oauth.login() redirects and returns null.
        if (!tokens) {
            return;
        }

        // Callback hit on the same route: tokens are returned here.
        req.session.tokens = tokens;
        res.redirect('/dashboard');
    } catch (error) {
        next(error);
    }
});

app.get('/dashboard', (req, res) => {
    if (!req.session.tokens) {
        res.status(401).send('Not logged in');
        return;
    }

    res.json({
        ok: true,
        tokens: req.session.tokens
    });
});

app.listen(3000, () => {
    console.log('Demo server running on http://localhost:3000/login');
});
