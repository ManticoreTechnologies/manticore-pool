

# EPSS - Evrmore Personal Stratum Server


EPSS is a high performance Stratum server in Node.js. One instance of this software can startup and 
manage multiple mining instances, each with their own daemon and stratum port. Thus it supports 
multiple ports with fixed or variable difficulty as well as multiple evrmored fallback instances.

EPSS is stratum server for solo mining without a pool. It sits between your mining software and the evrmored 
core node server. 

Your miner (evrprogpowminer) talks to your GPU card on one side (using CUDA or Open-CL) and to EPSS on the 
other side (using Stratum). Meanwhile, EPSS is also talking to evrmored on its other side using the core RPC
JSON commands.

** Use at your own risk ** 
This was pulled together for my development work. It may have bugs. It is not production-ready, primarily
because it has some old dependencies. This may be easy to fix.

EPSS is a code fork of https://github.com/RavenCommunity/kawpow-stratum-pool

Setup should be fairly easy, but you do need a functioning evrmorecoin core node set up and fully syncd.
I will not show how to get that portion working.

EPSS has been briefly tested and verified to work using Evrprogpowminer, TT-Miner, T-RexMiner,
GMiner, and NBMiner.


## Installation Instructions

It is possible and easiest to put all the pieces on one machine. But I did this work with the following
setup.

	-A evrmored full node running and fully synd on a Linux VM in the cloud. The RPC API is enabled, but
		only for local access. I assume you have ssh access.
	-A computer running the Windows OS which contains the GPU card and where the miner software will run
		I assume you've installed ssh so that you can log into your cloud Linux VMs from Windows Powershell.
	-An Ubuntu-20.04 VM in the cloud where EPSS will be setup and running. This way you can experiment and get
		everything working. If you have trouble, throw that VM away and start over. I assume you have
		ssh access.

## The Evrmore core node VM

Make sure it is running and fully synced. The evrmore.conf file might look like this:
```	
	mainnet=1
	server=1
	rpcuser=my-user-id
	rpcpassword=my-passw
	miningaddress=EZU3BcHJ5Deju9xaisko16QhFND369VwFj
	rpcallowip=127.0.0.1
```
	
	Notes:
	-the rpcallowip provides security. We will give remote access via ssh in the next step
	-the miningaddress MUST be present, because without it, the RPC command "getblocktemplate"
		does not provide all the information needed by the miner
	-make sure that you reboot the node after making changes to evrmore.conf so that they get read

Bring access to the evrmored RPC API port to your Windows system by forwarding the port privately via ssh

	-example for mainnet: 
	ssh -i path-to-my-key -L 8819:localhost:8819 my-user-id@my-evrmored-ip-address
		
		
## Evrprogpow Personal Stratum Server


Make sure that you have the dependencies installed:

	sudo apt-get update
	sudo apt-get install curl python2.7 build-essential libssl-dev
	sudo ln -s /usr/bin/python2.7 /usr/bin/python
	
Now install the Node version manager:

	curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

After running curl to install NVM, you should see in your output something like:
	=> Appending nvm source string to /home/ubuntu/.bashrc

To use NVM, you'll first need to restart your terminal or reload .bashrc:

	source /home/ubuntu/.bashrc

We want to use Node.js 8.1.4 so run:

	nvm install v8.1.4

Now let's install EPSS into your home directory

	cd ~
    mkdir evrmore-personal-stratum-server
    cd evrmore-personal-stratum-server
    git clone https://github.com/EvrmoreOrg/evrmore-personal-stratum-server.git
    cp evrmore-personal-stratum-server/package.json package.json
    cp evrmore-personal-stratum-server/server.js server.js
    npm install
    mv evrmore-personal-stratum-server node_modules/evrmore-personal-stratum-server
	
Hopefully that install and build all went smoothly
Now just copy the result over for Node.js:

	mv evrmore-personal-stratum-server node_modules/evrmore-personal-stratum-server
	
That should complete the installation of EPSS.
You will launch the app from the current directory (~/evrmore-personal-stratum-server)

Now open the file "server.js" in that directory using your favorite test editor.
Read this file carefully and change all configuration parameters to your choices.
The only items which you MUST change are:
    "address" and "rewardRecipients" near the top so that the proper addresses get paid, and
    "user" and "password" near the middle so that the core node RPC API can be accessed.

Before launching EPSS, we need to forward the appropriate ports for EPSS.
-The miner will run on the Windows box and needs access to the EPSS VM (on port 3333 if you 
didn't change it in "server.js")
-EPSS needs access to evrmored RPC (on port 8819 for mainnet).
We can accomplish both of those by running the following on the Windows box

	example for mainnet: 
	ssh -i path-to-mykey -R 8819:localhost:8819 -L 3333:localhost:3333 my-user-id@my-EPSS-ip-address

That's it! It should be ready to go.

For testing purposes, you might want to copy a linux evrmore-cli executable over to the EPSS
VM box for testing the connection to the evrmored RPC API.
-From the EPSS VM, you should be able to run the following and get a good response:

	./evrmore-cli -rpcuser=my-user-id -rpcpassword=my-passwd getblocktemplate
	
-Note that the answer from evrmored MUST end in providing "pprpcheader" and "pprpcepoch"
values. If it ends prematurely with the "default_witness_commitment" value then the
"miningaddress" parameter was not recognized by evrmored and mining won't work.
	
## Mining


To run EPSS, enter the following on the EPSS VM from directory "~/evrmore-personal-stratum-server":

	node server.js
	
Then on the Windows box, launch the miner. For example:

	./evrprogpowminer.exe -U -P stratum+tcp://EZU3BcHJ5Deju9xaisko16QhFND369VwFj.worker@127.0.0.1:3333

If you are over-mining mainnet (driving up the difficulty), then you should make the following
changes in "server.js":

	"blockRefreshInterval": 60000
	"getNewBlockAfterFound": false

