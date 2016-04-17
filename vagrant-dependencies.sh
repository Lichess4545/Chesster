#!/bin/bash
sudo apt-get install language-pack-en
curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
sudo apt-get install -y nodejs
ln -s /vagrant/ /home/vagrant/chesster
cd ~/chesster
sudo npm install -g --save botkit
sudo npm install -g --save async
sudo npm install -g --save fast-levenshtein
sudo npm install -g --save google-spreadsheet
sudo npm install -g --save mocha
sudo npm install -g --save chai
sudo npm install -g --save moment
sudo npm install -g --save merge
