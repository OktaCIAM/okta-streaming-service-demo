var express = require('express');
var app = express();
var cookieParser = require('cookie-parser');
const axios = require('axios');
var qs = require('qs');
var QRCode = require('qrcode');
require('dotenv').config();
const store = require("store2");

//HEADERS USED FOR ALL REQUEST
const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded'
}

const AUTHZID = process.env.AUTHZ_ID || 'default';

//set the view engine to ejs
app.set('view engine', 'ejs');
app.use(cookieParser());
app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {

    if (store('accessToken')) {
        res.status(301).redirect('/session');
    }

    if (req.cookies.resdata != null || req.cookies.resdata == '') {
        if(process.env.DEBUG === 'true'){
            console.log("Calling Token EndPoint");
        }
        
        //CREATE PAYLOAD FOR TOKEN ENDPOINT
        payload = {
            'client_id': process.env.CLIENT_ID,
            'grant_type': 'urn:ietf:params:oauth:grant-type:device_code',
            'device_code': req.cookies.resdata.device_code
        };

        if(store('accessToken')){
            return res.end();
        }

        //call Okta token endpoint.
        axios.post('https://' + process.env.OKTA_HOST + '/oauth2/' + AUTHZID + '/v1/token', qs.stringify(payload), { headers })
        .then(response => {
            //We got the access and id tokens
            store('accessToken', response.data.access_token);
            store('idToken', response.data.id_token);
            //ADDED line to capture refresh token
            if(response.data.refresh_token){
                store('refreshToken', response.data.refresh_token)
            }
            //Display Response if DEBUG
            if(process.env.DEBUG === 'true'){
                console.log(response.data);
            }   
        })
        .catch(error => {
            if(process.env.DEBUG === 'true'){
                console.log(error);
            }       
        })

        QRCode.toDataURL(req.cookies.resdata.verification_uri_complete, function (err, url) {
            if (err) return console.log("error occured")
            if(process.env.DEBUG === 'true'){
                console.log("***Okta Authorize Endpoint response***");
                console.log(req.cookies.resdata);
            }  
            res.render('pages/index', {
                jsonResData: JSON.stringify(req.cookies.resdata),
                welcomeLine: 'Please visit <a href="' + req.cookies.resdata.verification_uri + '" target="_blank">' + req.cookies.resdata.verification_uri + '</a> and enter code: ' + req.cookies.resdata.user_code + ' to activate your device.',
                qrCode: url,
                Code: req.cookies.resdata.device_code
            });
        });
    }
    else {
        if(process.env.DEBUG === 'true'){
            console.log("Calling Authorize EndPoint");
        }
        
        //CREATE PAYLOAD FOR AUTHZ ENDPOINT
        payload = {
            'client_id': process.env.CLIENT_ID,
            'scope': process.env.SCOPES || 'openid profile offline_access'  //will use default OIDC scopes if none are provided.
        }
        
        axios.post('https://' + process.env.OKTA_HOST + '/oauth2/' + AUTHZID + '/v1/device/authorize', qs.stringify(payload), { headers })
            .then(response => {
                QRCode.toDataURL(response.data.verification_uri_complete, function (err, url) {
                    if (err) return console.log("error occured")
                    if(process.env.DEBUG === 'true'){
                        console.log("***Okta Authorize Endpoint response***");
                        console.log(response.data);
                    }  
                    res.cookie("resdata", response.data);
                    res.render('pages/index', {
                        jsonResData: JSON.stringify(response.data),
                        welcomeLine: 'Please visit <a href="' + response.data.verification_uri + '" target="_blank">' + response.data.verification_uri + '</a> and enter code: ' + response.data.user_code + ' to activate your device.',
                        qrCode: url,
                        Code: response.data.device_code
                    });
                    res.end();
                })
            })
            .catch(error => {
                res.send(error.response.data);
            })
    }

})

app.get('/session', (req, res) => {

    //read the cookie not localStorage
    if (store('accessToken')) {

        res.clearCookie('resdata');
        res.cookie('accessToken', store('accessToken'));
        res.cookie('idToken', store('idToken'))
        //ADDED
        res.cookie('refreskToken', store('refreskToken'));
        res.render('pages/access', {
            accessToken: store('accessToken'),
            idToken: store('idToken')
        });
    }

    else {
        console.log('Missing tokens');
        res.status(302).redirect('/');
    }

})

app.get('/logout', (req, res) => {
    store.clearAll();
    res.clearCookie('accessToken');
    res.clearCookie('idToken');
    res.render('pages/logout');
})

app.listen(8080);
console.log('Server is listening on port 8080');