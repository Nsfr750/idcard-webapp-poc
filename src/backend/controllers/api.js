import { Router } from 'express';
import Groups from 'models/groupModel';
import IDCard from 'models/idcardModel';
import PWS from 'models/pwsModel';
import config from 'config/config.json';
import { ensureAPIAuth, ensureAuthOrToken, getAuthToken } from '../utils/helpers';
import { API } from 'Routes';

let api = Router();

api.get(API.GetMembers, async (req, res) => {
		let result = await Groups.GetMembers(req.params.group);
		let members = await PWS.GetMany(result.Payload);
		let verbose = await IDCard.GetManyPhotos(members);
		return res.status(result.Status).json(verbose);
});

api.get(API.Logout, (req,res) => {
	// console.log("PRESESSION", req.session);
	// let token = getAuthToken();
	// let user = req.user;
	// req.logout();
	// //req.session.destroy();
	// req.session = {};
	// req.session.registrationUser = user;
	// console.log("OMG SESSION", req.session);
	// res.status(200).json({token});
	let token = getAuthToken();
	req.logout();
	res.clearCookie('connect.sid');
	res.send("logged out", 401);
	//res.status(200).json({token});
});

api.put(API.RegisterMember, ensureAuthOrToken, async (req, res) => {
	let identifier = req.params.identifier;
	let validCard = IDCard.ValidCard(identifier);

	if(validCard){
		identifier = await IDCard.Get(validCard);
		identifier = (await PWS.Get(identifier)).UWNetID;
	}
	
	let result = await Groups.AddMember(req.params.group, identifier);
	let user = await PWS.Get(identifier);
	user.identifier = identifier;
	user.Base64Image = await IDCard.GetPhoto(user.UWRegID);
	res.status(result.Status).json(user);
});

api.delete(API.RemoveMember, ensureAPIAuth, async (req, res) => {
	let result = await Groups.RemoveMember(req.params.group, req.params.identifier);
	return res.status(result.Status).json(result.Payload);
});

api.get(API.GetSubgroups, ensureAPIAuth, async (req, res) => {
	let result = await Groups.SearchGroups(req.params.group);
	return res.status(result.Status).json(result.Payload);
});

api.delete(API.RemoveSubgroup, ensureAPIAuth, async (req, res) => {
	let result = await Groups.DeleteGroup(req.params.group);
	return res.status(result.Status).json(result.Payload);
});

api.post(API.CreateGroup, ensureAPIAuth, async (req, res) => {
	let result = await Groups.CreateGroup(req.params.group);
	return res.status(result.Status).json(result.Payload);
});

// Simple endpoint to verify user is authenticated
// If a UWNetID and DisplayName is returned it is displayed in the client
// This is just for show/hide, API doesn't rely on this
api.get(API.CheckAuth, (req, res) => {
	console.log("Check Auth Session", req.session)
	const defaultUser = { UWNetID: '', DisplayName: '' };
	const devUser = { UWNetID: 'developer', DisplayName: 'Developer' };

	if(req.isAuthenticated() || process.env.NODE_ENV === 'development') {
		return res.status(200).json({auth: req.user || devUser});
	} else {
		// using 202 because 4xx throws a dumb error in the chrome console,
		// anything but 200 is fine for this use case
		return res.status(202).json({auth: defaultUser});
	}
});

api.get(API.Config, (req, res) => {
	let whitelist = ["idcardBaseUrl", "pwsBaseUrl", "photoBaseUrl", "groupsBaseUrl", "groupNameBase"];
	let filteredConfig = Object.keys(config)
			.filter(key => whitelist.includes(key))
			.reduce((obj, key) => {
					obj[key] = config[key];
					return obj;
			}, {});
	res.status(200).json(filteredConfig);
});

api.get(API.CSV, async (req, res) => {
	let members = await Groups.GetMembers(req.params.group);
	let csvWhitelist = ["DisplayName", "UWNetID", "UWRegID"];
	let verboseMembers = await PWS.GetMany(members.Payload, csvWhitelist);
	res.csv(verboseMembers, true);
});

export default api;
