## My Personal Website

Hosted with github pages at [jjmorton.com](http://jjmorton.com)

### Build Instructions
The '/docs' directory is the built static version for GitHub pages, '/static' contains the static assets and '/views' contains the ejs templates.  
Build this directory using `npm run build` in the project's root.  
To compile LaTeX to png images, you will need `pnglatex` from [here](https://github.com/mneri/pnglatex).  
To host the non-static version, run `node server.js`, and use `node server-static.js` to host the static GitHub pages version.

