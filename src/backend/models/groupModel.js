import rp from 'request-promise';
import fs from 'fs';
import { FilterModel } from '../utils/helpers';

const GROUPSBASEURL = process.env.GROUPSBASEURL;
const CERTIFICATEFILE = process.env.CERTIFICATEFILE;
const PASSPHRASEFILE = process.env.PASSPHRASEFILE;
const INCOMMONFILE = process.env.INCOMMONFILE;
const GROUPDISPLAYNAME = process.env.GROUPDISPLAYNAME;
const CONTROLLING_CERTIFICATE = process.env.CONTROLLING_CERTIFICATE || 'integrations.event.uw.edu';
const BASE_ADMIN_GROUP = process.env.BASE_ADMIN_GROUP || process.env.BASE_GROUP + '-admin';

const options = {
  method: 'GET',
  url: '',
  json: true,
  ca: [fs.readFileSync(INCOMMONFILE, { encoding: 'utf8' })],
  agentOptions: {
    pfx: fs.readFileSync(CERTIFICATEFILE),
    passphrase: fs.readFileSync(PASSPHRASEFILE, { encoding: 'utf8' }).toString(),
    securityOptions: 'SSL_OP_NO_SSLv3'
  }
};

const SuccessResponse = (Payload, Status = 200) => {
  return {
    Status,
    Payload
  };
};
const ErrorResponse = ex => {
  return {
    Status: ex.statusCode,
    Payload: ex.error.errors
  };
};

const GetGroupInfo = async group => {
  let opts = Object.assign({}, options, {
    method: 'GET',
    url: `${GROUPSBASEURL}/group/${group}`
  });
  try {
    let res = await rp(opts);
    return res.data;
  } catch (ex) {
    throw ex;
  }
};

// flattens groups/subgroups into members lists recursively
const groupsToMembers = async group => {
  let members = (await Groups.GetMembers(group)).Payload;
  let spread = await members.map(async m => {
    if (m.type !== 'group') {
      return m.id;
    } else {
      return await groupsToMembers(m.id);
    }
  });
  return [].concat.apply([], await Promise.all(spread));
};

const Groups = {
  async IsConfidentialGroup(group) {
    return (await GetGroupInfo(group)).classification === 'c';
  },
  async UpdateGroup(group) {
    return false;
  },
  async AddMember(group, identifier) {
    let opts = Object.assign({}, options, {
      method: 'PUT',
      url: `${GROUPSBASEURL}/group/${group}/member/${identifier}`
    });
    try {
      let res = await rp(opts);
      if (res.errors[0].notFound.length > 0) {
        return ErrorResponse({ statusCode: 404, error: { errors: 'User Not Found' } });
      }
      return SuccessResponse(res.errors[0], res.errors[0].status);
    } catch (ex) {
      return ErrorResponse(ex);
    }
  },
  async GetMembers(group, force = false) {
    let opts = Object.assign({}, options, {
      url: `${GROUPSBASEURL}/group/${group}/member${force ? '?source=registry' : ''}`
    });
    try {
      let res = await rp(opts);

      return SuccessResponse(res.data, res.error);
    } catch (ex) {
      return ErrorResponse(ex);
    }
  },
  async GetAdmins(group) {
    try {
      let groupInfo = (await GetGroupInfo(group)).admins;

      let admins = await groupInfo.map(async admin => {
        if (admin.type !== 'group') {
          return admin.id;
        } else {
          let temp = await groupsToMembers(admin.id);
          console.log('DONE', temp);
          return temp;
        }
      });

      admins = [].concat.apply([], await Promise.all(admins));
      console.log('FINAL ADMIS', admins);
      return SuccessResponse(admins);
    } catch (ex) {
      console.log(ex);
      return ErrorResponse(ex);
    }
  },
  async RemoveMember(group, netid) {
    let opts = Object.assign({}, options, {
      method: 'DELETE',
      url: `${GROUPSBASEURL}/group/${group}/member/${netid}?synchronized=true`
    });
    try {
      let res = await rp(opts);
      return SuccessResponse(res.errors[0], res.errors[0].status);
    } catch (ex) {
      return ErrorResponse(ex);
    }
  },
  async CreateGroup(group, confidential, description, email) {
    let classification = confidential == 'false' ? 'u' : 'c';
    let readers = confidential == 'false' ? [] : [{ type: 'set', id: 'none' }];

    let admins = [{ id: BASE_ADMIN_GROUP, type: 'group' }, { id: CONTROLLING_CERTIFICATE, type: 'dns' }];

    let opts = Object.assign({}, options, {
      method: 'PUT',
      url: `${GROUPSBASEURL}/group/${group}?synchronized=true`,
      body: {
        data: {
          id: group,
          displayName: GROUPDISPLAYNAME,
          description,
          admins,
          readers,
          classification
        }
      }
    });

    try {
      let res = await rp(opts);
      if (email === 'true') {
        rp(
          Object.assign({}, options, {
            method: 'PUT',
            url: `${GROUPSBASEURL}/group/${group}/affiliate/google?status=active&sender=member`
          })
        );
      }
      return SuccessResponse(res.data);
    } catch (ex) {
      console.log(ex);
      return ErrorResponse(ex);
    }
  },

  async SearchGroups(group, verbose = false) {
    let opts = Object.assign({}, options, {
      method: 'GET',
      url: `${GROUPSBASEURL}/search?stem=${group}&owner=${CONTROLLING_CERTIFICATE}&type=effective&scope=all`
    });

    try {
      let data = (await rp(opts)).data;
      if (verbose) {
        let promises = [];
        let verboseGroups = [];
        await Promise.all(
          data.map(async g => {
            let vg = await GetGroupInfo(g.regid);
            if (vg.affiliates.length > 1) {
              vg.email = `${vg.id}@uw.edu`;
            }
            verboseGroups.push(vg);
          })
        );
        let filter = ['regid', 'displayName', 'id', 'url', 'description', 'classification', 'email'];
        verboseGroups = verboseGroups.map(vg => {
          return FilterModel(vg, filter);
        });
        data = verboseGroups;
      }
      return SuccessResponse(
        data.sort(function(a, b) {
          return a.id < b.id;
        })
      );
    } catch (ex) {
      return ErrorResponse(ex);
    }
  },
  async DeleteGroup(group) {
    let opts = Object.assign({}, options, {
      method: 'DELETE',
      url: `${GROUPSBASEURL}/group/${group}?synchronized=true`
    });
    try {
      let res = await rp(opts);
      return SuccessResponse(res.errors[0], res.errors[0].status);
    } catch (ex) {
      return ErrorResponse(ex);
    }
  }
};

export default Groups;
