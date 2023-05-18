const express = require('express');
const xml2js=require('xml2js');
const bodyparser=require('body-parser');
const fs=require('fs');
const app = express();
const port = 3000;
const {google} = require('googleapis');
app.use(express.json());
var request = require('request');
const { type } = require('os');
const path = require('path');
const schedule=require('node-schedule');
var csv;
var date;
var currencies={};
var id={};
var count=0;

const client_id = '955046341181-2nn2v7q98lvborm3hvaaoenbr6h980hv.apps.googleusercontent.com';
const client_secret = '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';
const redirect_uri = 'https://developers.google.com/oauthplayground';
const refresh_token = '1//04vIgq6jeC0fXCgYIARAAGAQSNwF-L9Ir2XK3ReqmRjyoJzrg2-jL-Yv2dZlo097wZYPAD9UBE22Cpd5lUfmteEHsBfdDasPyiZg';

const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uri
);
oauth2Client.setCredentials({refresh_token});

const drive = google.drive({
    version: 'v3',
    auth: oauth2Client
})

async function uploadFile(fileName,index){
    try{
        filePath=path.join(__dirname,'Drive');
        filePath=path.join(filePath,fileName);
        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                mimeType: 'text/plain'
            },
            media: {
                mimeType: 'text/plain',
                body: fs.createReadStream(filePath)
            }
        })
        id[index]=response.data.id;
    } catch(error) {
        console.log(error.message);
    }
}

async function deleteFile(fileName){
    try{
        const response=await drive.files.delete({
            fileId:fileName,
        });
    }catch(error){
        console.log(error.message);
    }
}

app.use(express.urlencoded({extended: true}));

app.use(express.static('public'));

request.get('https://www.bnr.ro/nbrfxrates.xml', function (error, response, body) {
    if (!error && response.statusCode == 200) {
        const parser=new xml2js.Parser();
        parser.parseStringPromise(body)
            .then(function(res){
                csv=res;
            })
    }
});
today=new Date();
yy=today.getFullYear();
mm=today.getMonth()+1;
dd=today.getDate();
if(mm<10) mm='0'+mm;
if(dd<10) dd='0'+dd;
date=yy+"-"+mm+"-"+dd;

app.get('/', (req, res) => {
    res.send(csv);
});

function checkValue(value,multiplier){
    if(multiplier!=undefined) {
        valueAux=parseFloat(value);
        multiplier=parseFloat(multiplier);
        valueAux=valueAux/multiplier;
        value=String(valueAux);
    }
    return value;
}

app.post('/currencies',(req,res)=>{
    date=String(req.query.date);
    index=0;ok=0;
    for (const obj of csv.DataSet.Body[0].Cube){
        if((String(obj.$.date))==date){
            ok=1;
            break;
        }
        index++;
    }
    if(ok==0) {
        res.json("Data invalida");
    }
    else {
        rate=csv.DataSet.Body[0].Cube[index].Rate;
        for (const obj of rate){
            currency=obj.$.currency;
            value=obj._;
            value=checkValue(value,obj.$.multiplier);
            currencies[currency]=value;
        }
        res.json(currencies);
    }
});


app.post('/preferred',(req,res)=>{
    currency_preffered=req.query.currency;
    rate=csv.DataSet.Body[0].Cube[0].Rate;
        for (const obj of rate){
            currency=obj.$.currency;
            value=obj._;
            value=checkValue(value,obj.$.multiplier);
            currencies[currency]=value;
        }
    value=currencies[currency_preffered];
    if(value==undefined) {
        res.json("Moneda invalida");
    }
    else {
        let rawdata=fs.readFileSync('Drive/preferred.json');
        let preferred=JSON.parse(rawdata);
        let ok=1;
        response={};
        for (const obj of Object.keys(preferred)){
            if(obj==currency_preffered) {
                ok=0;
                break;
            }
            response[obj]=currencies[obj];
        }
        if(ok==0) res.json("Already there!");
        else {
            response[currency_preffered]=value;
            console.log(Object.keys(response));
            for(const obj of Object.keys(response)){
                pathFile="Drive/"+obj+".txt";
                fs.writeFileSync(pathFile,String(response[obj]));
            }
            data=JSON.stringify(response);
            fs.writeFileSync("Drive/preferred.json",data);
            res.json(response);
        }
    }
});

schedule.scheduleJob('* 17 * * *', function(){
    let rawdata=fs.readFileSync('Drive/preferred.json');
    let preferred=JSON.parse(rawdata);
    for(obj of Object.keys(id)){
        deleteFile(id[obj]);
    }
    count=0;
    for (const obj of Object.keys(preferred)){
        uploadFile(obj+".txt",count);
        count++;
    }
})

app.listen(port);