common-passwords.txt

The 100,000 most common passwords from the "Xato" collection as published in SecLists
(https://github.com/danielmiessler/SecLists, Passwords/Common-Credentials), lower-cased,
with the entries shorter than 8 characters removed because the password rules already
refuse those. The backend loads it once at startup (utils/passwordPolicy.js) and refuses
passwords that appear in it. Nothing is sent anywhere: the check is entirely offline.

SecLists is released under the MIT License, Copyright (c) 2018 Daniel Miessler.
MIT License

Copyright (c) 2018 Daniel Miessler

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
