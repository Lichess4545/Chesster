#!/bin/bash
sudo apt-get install language-pack-en
curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
sudo apt-get install -y nodejs
ln -s /vagrant/ /home/vagrant/modster
cd ~/modster
npm install --save botkit
npm install --save async
npm install --save levenshtein
npm install --save google-spreadsheet

