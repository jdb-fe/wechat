'use strict';
const path = require('path');
const express = require('express');
const timeout = require('connect-timeout');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const nunjucks = require('nunjucks');
const AV = require('leanengine');

const app = express();

global.Config = {
    wechat: {
        token: process.env.WX_TOKEN,
        appid: process.env.WX_APPID_TEST,
        encodingAESKey: process.env.WX_AESKEY,
        appsecret: process.env.WX_APPSECRET_TEST
    }
};


const post = require('./routes/post');
const wechat = require('./routes/wechat');
const rule = require('./routes/rule');

const env = process.env.NODE_ENV || 'development';
const logstyle = env === 'production' ? 'combined' : 'dev';
app.use(morgan(logstyle));
// nunjucks配置
nunjucks.configure('views', {
    autoescape: false,
    express: app
}).addGlobal('title', 'FE');
app.engine('html', nunjucks.render);
app.set('view engine', 'html');

app.use(express.static('public'));
// 设置默认超时时间
app.use(timeout('15s'));
// 加载云函数定义
require('./cloud');
// 加载云引擎中间件
app.use(AV.express());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(cookieParser());
app.use(express.query());

app.get('/', (req, res) => {
    res.render('index', {
        title: '首页',
        currentTime: new Date()
    });
});
app.use('/post', post);
app.use('/wechat', wechat);
app.use('/rule', rule);

app.use((req, res, next) => {
    if (!res.headersSent) {
        let err = new Error('Not Found');
        err.status = 404;
        next(err);
    }
});

// error handlers
app.use((err, req, res, next) => {
    if (req.timedout && req.headers.upgrade === 'websocket') {
        // 忽略 websocket 的超时
        return;
    }

    let statusCode = err.status || 500;
    if (statusCode === 500) {
        console.error(err.stack || err);
    }
    if (req.timedout) {
        console.error('请求超时: url=%s, timeout=%d, 请确认方法执行耗时很长，或没有正确的 response 回调。', req.originalUrl, err.timeout);
    }
    res.status(statusCode);
    // 默认不输出异常详情
    let error = {}
    if (app.get('env') === 'development') {
        // 如果是开发环境，则将异常堆栈输出到页面，方便开发调试
        error = err;
    }
    res.render('error', {
        message: err.message,
        error: error
    });
});

const schedule = require('./utils/schedule');
// 定时任务，每周五晚上推送
schedule.push({
    dayOfWeek: [5],
    hour: 21
});

module.exports = app;