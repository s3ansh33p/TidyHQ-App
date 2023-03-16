/**
 * @fileoverview Simple express app for testing
 * @author Sean McGinty <newfolderlocation@gmail.com>, ComSSA 2023
 */

// Imports
const dotenv = require('dotenv');
dotenv.config();

// Import will change eventually
const TidyHQ = require('../module/index.js');

const express = require('express');
const app = express();

const clientID =        process.env.CLIENT_ID;
const clientSecret =    process.env.CLIENT_SECRET;
const redirectURI =     process.env.REDIRECT_URI;
const port =            process.env.PORT || 4000;

const ACCESS_TOKEN =    process.env.ACCESS_TOKEN; // temporary

// tidyhq client
let client = new TidyHQ(clientID, clientSecret, redirectURI, ACCESS_TOKEN);

// Routes
app.get('/', (req, res) => {
    res.send('Hello World!');
})

// will need to add OAuth handling for access token eventually

app.get('/contact', async (req, res) => {
    let contactID = req.query.id;
    if (contactID == null) {
        res.send('No contact ID provided (id)');
    } else {
        let contact = await client.Contacts.getContact(contactID);
        res.json(contact);
    }
})

app.get('/ismember', async (req, res) => {
    if (req.query.id == null) {
        res.send("No student ID provided (id)");
    }
    let field = await client.CustomFields.getCustomFieldByName("Curtin Student ID Number");
    let group = await client.Groups.getGroupByName("Current Members");
    let contact = await client.Groups.getGroupContacts(group.id, {
        "filter": [{
            "custom_field_id": field.id,
            "custom_field_value": req.query.id
        }]
    })
    if (contact.length == 0) {
        res.send("Contact not found");
    } else {
        contact = contact[0];
        res.send(contact.first_name + " " + contact.last_name + " (" + contact.email_address + ") is a member of ComSSA");
    }
})

app.get('/group', async (req, res) => {
    if (req.query.name == null) {
        res.send("No group name provided (name)");
    }
    try {
        let group = await client.Groups.getGroupByName(decodeURIComponent(req.query.name));
        let contacts = await client.Groups.getGroupContacts(group.id);
        let result = "<h2>" + group.label + " (ID: " + group.id + ")</h2><table><tr><th>#</th><th>Name</th><th>Email</th><th>More Info</th></tr>";
        for (let i = 0; i < contacts.length; i++) {
            let contact = contacts[i];
            result += "<tr><td>" + (i+1) + "</td><td>" + contact.first_name + " " + contact.last_name + "</td><td>" + contact.email_address + "</td><td><a href='/contact?id=" + contact.id + "'>ID: " + contact.id + "</a></td></tr>";
        }
        res.send(result + "</table>");
    } catch (error) {
        res.send("Group not found");
    }
})

app.get('/group2', async (req, res) => {
    if (req.query.name == null) {
        res.send("No group name provided (name)");
    }
    try {
        let group = await client.Groups.getGroupByName(decodeURIComponent(req.query.name));
        let contacts = await client.Groups.getGroupContacts(group.id);
        let result = "";
        for (let i = 0; i < contacts.length; i++) {
            let contact = contacts[i];
            result += '"' + contact.first_name + ' ' + contact.last_name + '",';
        }
        res.send(result);
    } catch (error) {
        res.send("Group not found");
    }
})

// Start server
app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})
