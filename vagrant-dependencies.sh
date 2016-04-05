#!/bin/bash
sudo apt-get install language-pack-en
curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
sudo apt-get install -y nodejs
ln -s /vagrant/ /home/vagrant/chesster
cd ~/chesster
npm install --save botkit
npm install --save async
npm install --save fast-levenshtein
npm install --save google-spreadsheet

