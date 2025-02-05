// Global site variables go here
module.exports = {
    name: "Turtl Time",
    description: "I doin a thing",
    logoUrl: "/assets/images/logo.png",
    url: process.env.URL || "http://localhost:8080",
    buildTime: new Date(),
    environment: process.env.ELEVENTY_ENV,

    favicon: {
        ico: "/assets/favicons/favicon.ico",
        svg: "/assets/favicons/favicon.svg",
        png32: "/assets/favicons/favicon-32x32.png",
        png16: "/assets/favicons/favicon-16x16.png",
        appleTouchIcon: "/assets/favicons/apple-touch-icon.png",
        manifest: "/assets/favicons/site.webmanifest"
    }
};