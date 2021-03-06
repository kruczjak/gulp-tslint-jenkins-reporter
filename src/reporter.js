'use strict';

const _ = require('lodash');
const File = require('vinyl');
const fs = require('fs');
const path = require('path');
const plexer = require('plexer');
const Stream = require('readable-stream');
const upath = require('upath');
const mkdirp = require('mkdirp');

const Formatter = require('./formatter');

module.exports = {
    getReportedFilePath: getReportedFilePath,
    getSettings: getSettings,
    report: report
};

function report(options) {
    const inputStream = new Stream.Transform({ objectMode: true });
    const outputStream = new Stream.PassThrough({ objectMode: true });
    const stream = plexer({ objectMode: true }, inputStream, outputStream);
    let filesBuffer = [];
    
    const settings = getSettings(options);
    const formatter = new Formatter(settings);
    
    inputStream._transform = function(file, unused, done) {
        const vinyl = new File(file);
        const reportPath = getReportedFilePath(settings, vinyl);
        
        filesBuffer.push({
            xml: formatter.formatFile(reportPath, file.tslint.failures),
            path: reportPath
        });

        outputStream.write(file);
        done();
    };
    
    inputStream._flush = function(done) {
        if (settings.sort) {
            filesBuffer = _.sortBy(filesBuffer, 'path');
        }
        
        const content = formatter.formatStream(filesBuffer, settings);
        outputStream.end();

        mkdirp(settings.outputDir, function() {
            fs.writeFile(settings.filename, content, function(err) {
                if (err) {
                    console.error(err);
                }
        
                done();
            });
        });
    };
    
    return stream;
}

function getSettings(options) {
    const settings = options || {};
    
    _.defaults(settings, {
        sort: false,
        filename: 'checkstyle.xml',
        severity: 'error',
        pathBase: '',
        pathPrefix: ''
    });
    
    settings.filename = upath.normalize(settings.filename);
    settings.outputDir = path.dirname(settings.filename);
    
    if (settings.pathBase) {
        settings.pathBase = upath.normalize(settings.pathBase);
    }
    
    if (settings.pathPrefix) {
        settings.pathPrefix = upath.normalize(settings.pathPrefix);
    }
    
    return settings;
}

function getReportedFilePath(settings, vinyl) {
    let result = upath.normalize(vinyl.path);
    
    if (settings) {
        if (settings.pathBase) {
            const index = result.indexOf(settings.pathBase);
            if (index > 0) {
                result = result.substr(index + settings.pathBase.length);
            }
        }
        
        if (settings.pathPrefix) {
            result = path.join(settings.pathPrefix, result);
        }
    }
    
    if (path.sep === path.win32.sep) {
        result = result.replace(/\//, path.win32.sep);
    }
    
    return result;
}
