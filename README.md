- create venv and install requirements
```
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
- run app.py in venv
```
./venv/bin/python3 app.py
```
- run server
```
npm install
node server.js
```
- see plag logs in `./venv/bin/python3 app.py`
# to test in postman
- say our image is "img.jpg"
- in linux
```
base64 -w 0 img.jpg > img.txt
```
- in windows
```
[Convert]::ToBase64String([IO.File]::ReadAllBytes("img.jpg")) > img.txt
```
- this will generate a text file with base64 encoded image "img.txt"
- in postman, make a POST request to http://localhost:5000/analyze
- in body, select raw and select JSON
- in JSON, add this
```
{
  "image": "data:image/jpeg;base64,PUT_BASE64_STRING_HERE"
}

```