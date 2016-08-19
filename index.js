'use strict';
var fs = require('fs');
var mime = require("mime");

var csslink_reg = /<link rel="stylesheet" href="(\/styles[^"]*)/g;
var jslink_reg = /<script src="(\/scripts[^"]*)/g;
var imglink_reg = /src="(\/images[^"]*)/g;
var imgbglink_reg = /url\((\/images[^\)]*)/g;
var image_in_tpl_reg = /src=\\"(\/images[^\\]*)/g;
var jslink_in_tpl_reg = /<script src=\\"(\/scripts[^\\]*)/g;
var timestamp_reg = /TIMESTAMP_REPLACE/g;

var khorium_config = {};

var rmdirSync = (function() {
    function iterator(url, dirs) {
        var stat = fs.statSync(url);
        if (stat.isDirectory()) {
            dirs.unshift(url); //收集目录
            inner(url, dirs);
        } else if (stat.isFile()) {
            fs.unlinkSync(url); //直接删除文件
        }
    }

    function inner(path, dirs) {
        var arr = fs.readdirSync(path);
        for (var i = 0, el; el = arr[i++];) {
            iterator(path + "/" + el, dirs);
        }
    }
    return function(dir, cb) {
        cb = cb || function() {};
        var dirs = [];

        try {
            iterator(dir, dirs);
            for (var i = 0, el; el = dirs[i++];) {
                fs.rmdirSync(el); //一次性删除所有收集到的目录
            }
            cb()
        } catch (e) { //如果文件或目录本来就不存在，fs.statSync会报错，不过我们还是当成没有异常发生
            e.code === "ENOENT" ? cb() : cb(e);
        }
    }
})();

function getAllFiles(root) {
    var result = [],
        files = fs.readdirSync(root)
    files.forEach(function(file) {
        var pathname = root + "/" + file,
            stat = fs.lstatSync(pathname)
        if (stat === undefined) return

        // 不是文件夹就是文件
        if (!stat.isDirectory()) {
            result.push(pathname)
                // 递归自身
        } else {
            result = result.concat(getAllFiles(pathname))
        }
    });
    return result
}

function readfile(filename, callback) {
    fs.readFile(filename, {
        encoding: 'utf8'
    }, function(err, data) {
        callback(data);
    });
}

function writefile(filename, content) {
    fs.writeFile(filename, content, function(error) {
        console.log('wite file: ' + filename);
    });
}

function dealcss(filename) {
    readfile(filename, function(fcontent) {
        fcontent = fcontent.replace(imgbglink_reg, 'url(' + khorium_config.image + '$1' + '?' + khorium_config.timestamp);
        writefile(filename, fcontent);
    });
}

function dealjs(filename) {
    readfile(filename, function(fcontent) {
        fcontent = fcontent.replace(imgbglink_reg, 'url(' + khorium_config.image + '$1' + '?' + khorium_config.timestamp).replace(imglink_reg, 'src="' + khorium_config.image + '$1' + '?' + khorium_config.timestamp).replace(image_in_tpl_reg, 'src=\\"' + khorium_config.image + '$1' + '?' + khorium_config.timestamp).replace(timestamp_reg, function() {
            return new Date().getTime()
        }).replace(jslink_in_tpl_reg, '<script src=\\"' + khorium_config.js + '$1' + '?' + khorium_config.timestamp);
        writefile(filename, fcontent);
    });
}

function dealhtml(filename) {
    readfile(filename, function(fcontent) {
        fcontent = fcontent.replace(imgbglink_reg, 'url(' + khorium_config.image + '$1' + '?' + khorium_config.timestamp).replace(jslink_reg, '<script src="' + khorium_config.js + '$1' + '?' + khorium_config.timestamp).replace(csslink_reg, '<link rel="stylesheet" href="' + khorium_config.css + '$1' + '?' + khorium_config.timestamp).replace(imglink_reg, 'src="' + khorium_config.image + '$1' + '?' + khorium_config.timestamp);
        writefile(filename, fcontent);
    });
}

function dealwith(filename) {
    var mimetype = mime.lookup(filename);
    switch (mimetype) {
        case 'text/css':
            dealcss(filename);
            break;
        case 'text/html':
        case 'application/vnd.groove-tool-template':
            dealhtml(filename);
            break;
        case 'application/javascript':
            dealjs(filename);
            break;
        default:
    }
}

function dealmainfest(manifest, callback) {
    if (manifest['action']) {
        switch (manifest['action']) {
            case 'cleanAsset':
                //清除废旧资源
                readfile(manifest.conf.fileLocate, function(content) {
                    for (var oldversionFile in JSON.parse(content)) {
                        fs.unlinkSync(manifest.conf.dir + oldversionFile);
                        // console.log('rm file ' + manifest.conf.dir + oldversionFile);
                    }
                    console.log('Action :cleanAsset complete!');
                    callback();
                });
        }
    }
}

module.exports = {
    del: function(dirs) {
        dirs.forEach(function(dir) {
            rmdirSync(dir, function(e) {});
        });
    },
    run: function(opt) {
        console.log('Start rm old Asset');
        if (opt.manifest) {
            dealmainfest(opt.manifest, function() {
                console.log('Start replace static resource file url');
                var docs = getAllFiles(opt.path);
                khorium_config = opt;
                khorium_config.timestamp = "", //new Date().getTime();
                    docs.forEach(function(doc) {
                        dealwith(doc);
                    });
            });
        } else {
            console.log('Start replace static resource file url');
            var docs = getAllFiles(opt.path);
            khorium_config = opt;
            khorium_config.timestamp = new Date().getTime(), //new Date().getTime();
                docs.forEach(function(doc) {
                    dealwith(doc);
                });
        }
    }
};