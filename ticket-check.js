/**
 * @fileoverview Simple express app for testing
 * @author Sean McGinty <newfolderlocation@gmail.com>, ComSSA 2023
 */

// Imports
const dotenv = require('dotenv');
dotenv.config();
const { JsonDB, Config } = require('node-json-db');
const db = new JsonDB(new Config("comssa-data", true, false, '/'));
// starting tickets db
db.push("/last_fetch/tickets", {});
db.push("/last_fetch/ticket-info", {});

// Import will change eventually
const TidyHQ = require('../module/index.js');

const express = require('express');
const session = require('express-session');
const app = express();

const clientID =        process.env.CLIENT_ID;
const clientSecret =    process.env.CLIENT_SECRET;
const redirectURI =     process.env.REDIRECT_URI;
const port =            process.env.PORT || 4000;
const expressSecret =   process.env.EXPRESS_SECRET;

const username =        process.env.USER;
const password =        process.env.PASS;

const ACCESS_TOKEN =    process.env.ACCESS_TOKEN; // temporary

// cache timeout so we don't spam tidyhq and faster
const CACHE_TIMEOUT = 10 * 60 * 1000; // 10 minutes

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
	secret: expressSecret,
	resave: true,
	saveUninitialized: true
}));

// tidyhq client
let client = new TidyHQ(ACCESS_TOKEN);

// local cache
async function updateCacheEvents() {
    console.log("Updating cache for events")
    const events = await client.Events.getEvents();
    await db.push("/events", events);
    await db.push("/last_fetch/events", Date.now());
    return events;
}

async function updateCacheTickets(event_id) {
    console.log("Updating cache for tickets")
    const tickets = await client.Tickets.getSoldTickets(event_id);
    await db.push("/tickets/" + event_id, tickets);
    await db.push("/last_fetch/tickets/" + event_id, Date.now());
    return tickets;
}

async function updateCacheTicketInfo(event_id) {
    console.log("Updating cache for ticket info")
    const ticket_info = await client.Tickets.getTickets(event_id);
    await db.push("/ticket-info/" + event_id, ticket_info);
    await db.push("/last_fetch/ticket-info/" + event_id, Date.now());
    return ticket_info;
}

// get from local cache
async function getCacheEvents() {
    console.log("Getting cache for events");
    let last_fetch = 0;
    try {
        last_fetch = await db.getData("/last_fetch/events");
    } catch (error) {
        await db.push("/last_fetch/events", 0);
    }
    if (Date.now() - last_fetch > CACHE_TIMEOUT) {
        return await updateCacheEvents();
    }
    return await db.getData("/events");
}

async function getCacheEvent(event_id) {
    const events = await getCacheEvents();
    for (let i = 0; i < events.length; i++) {
        if (events[i].id == event_id) {
            return events[i];
        }
    }
    return null;
}

async function getCacheTickets(event_id) {
    console.log("Getting cache for tickets");
    let last_fetch = 0;
    try {
        last_fetch = await db.getData("/last_fetch/tickets/" + event_id);
    } catch (error) {
        await db.push("/last_fetch/tickets/" + event_id, 0);
    }
    if (Date.now() - last_fetch > CACHE_TIMEOUT) {
        return await updateCacheTickets(event_id);
    }
    return await db.getData("/tickets/" + event_id);
}

async function getCacheTicketInfo(event_id) {
    console.log("Getting cache for ticket info");
    let last_fetch = 0;
    try {
        last_fetch = await db.getData("/last_fetch/ticket-info/" + event_id);
    } catch (error) {
        await db.push("/last_fetch/ticket-info/" + event_id, 0);
    }
    if (Date.now() - last_fetch > CACHE_TIMEOUT) {
        return await updateCacheTicketInfo(event_id);
    }
    return await db.getData("/ticket-info/" + event_id);
}

// auth guard middleware
function authGuard(req, res, next) {
    if (req.session.loggedin) {
        next();
    } else {
        res.redirect('/auth');
    }
}

// Routes
app.get('/auth', (req, res) => {
    res.sendFile(__dirname + '/auth.html');
})

app.post('/login', (req, res) => {
    const user = req.body.username;
    const pass = req.body.password;
    if (!user || !pass) {
        res.status(400).json({
            "success": false,
            "message": "No username or password provided"
        });
    } else {
        if (user == username && pass == password) {
            // set session to logged in
            req.session.loggedin = true;
            res.status(200).json({
                "success": true,
                "message": "Logged in"
            });
        } else {
            res.status(401).json({
                "success": false,
                "message": "Incorrect username or password"
            });
        }
    }
})

app.get('/events', authGuard, async (req, res) => {
    let events = await getCacheEvents();
    res.status(200).json({
        "success": true,
        "message": events
    });
})

app.get('/event/:id', authGuard, async (req, res) => {
    // get event id in query
    if (!req.params.id) {
        res.status(400).json({
            "success": false,
            "message": "No event id provided"
        });
    } else {
        let event_id = req.params.id;
        let event = await getCacheEvent(event_id);
        if (event) {
            res.status(200).json({
                "success": true,
                "message": event
            });
        } else {
            res.status(404).json({
                "success": false,
                "message": "Event not found"
            });
        }
    }
})

app.get('/tickets', authGuard, async (req, res) => {
    // get event id in query
    if (!req.query.event_id) {
        res.status(400).json({
            "success": false,
            "message": "No event_id provided"
        });
    } else {
        let event_id = req.query.event_id;
        let tickets = await getCacheTickets(event_id);
        res.status(200).json({
            "success": true,
            "message": tickets
        });
    }
})

app.get('/check', authGuard, async (req, res) => {
    // check code parameter
    if (!req.query.code || !req.query.event) {
        res.status(400).json({
            "success": false,
            "message": "Code or event not provided"
        });
    } else {
        let code = req.query.code;
        let event_id = req.query.event;
        // call get tickets
        // let tickets = await client.Tickets.getSoldTickets(event_id);
        let tickets = await getCacheTickets(event_id);
 
        // check if code is in tickets
        let found = false;
        let i;
        for (i = 0; i < tickets.length; i++) {
            let ticket = tickets[i];
            if (ticket.code == code) {
                found = ticket;
                break;
            }
        }
        // send 404 response with json
        if (!found) {
            res.status(404).json({
                "success": false,
                "message": "Code not found"
            });
        } else {
            // get contact
            const contact = await client.Contacts.getContact(found.contact_id);
            let studentID = contact.custom_fields.find(field => field.title == "Curtin Student ID Number");
            if (studentID) {
                studentID = studentID.value;
            } else {
                studentID = "N/A";
            }

            // get ticket info
            const ticket_info = await getCacheTicketInfo(event_id);
            const ticket_type = ticket_info.find(type => type.id == found.ticket_id);
            const ticket_name = ticket_type.name;
            // for each ticket type sum quantity_sold
            let ticket_quantity = 0;
            for (let j = 0; j < ticket_info.length; j++) {
                ticket_quantity += ticket_info[j].quantity_sold;
            }
            // send 200 response with json
            res.status(200).json({
                "success": true,
                "message": {
                    "name": contact.first_name + ' ' + contact.last_name,
                    "phone": contact.phone_number,
                    "email": contact.email_address,
                    "studentID": studentID,
                    "num": i+1,
                    "max": ticket_quantity,
                    "type": ticket_name
                }
            });
        }
    }
})

app.get('/scan', authGuard, (req, res) => {
    res.sendFile(__dirname + '/dev.html');
})

app.get('/', authGuard, (req, res) => {
    res.sendFile(__dirname + '/index.html');
})


// Start server
app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})
