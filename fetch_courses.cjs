const https = require('https');
https.get('https://targetzerotraining.co.uk/wp-json/custom/v1/products', (resp) => {
    let data = '';
    resp.on('data', (chunk) => { data += chunk; });
    resp.on('end', () => {
        try {
            const json = JSON.parse(data);
            const courses = Array.isArray(json) ? json : Object.values(json);
            const names = [...new Set(courses.map(c => c.name.split('|')[0].trim()))];
            console.log(JSON.stringify(names, null, 2));
        } catch (e) { console.error(e.message); }
    });
}).on("error", (err) => { console.error("Error: " + err.message); });
