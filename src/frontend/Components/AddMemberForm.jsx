import React from 'react';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';

export default class Form extends React.Component {
  registerUser = e => {
    e.preventDefault();
    let identifier = e.target.registerCard.value;
    if (identifier.length) {
      // if identifier is a magstrip, remove the semicolon
      identifier = identifier[0] === ';' ? identifier.slice(1, -1) : identifier;
      this.props.addUser(this.props.group, identifier);
      document.getElementById('registerCard').value = '';
    }
  };

  render() {
    return (
      <form className="form" autoComplete="new-password" onSubmit={this.registerUser} id="addUserForm">
        <div className="registerForm">
          <TextField autoFocus={true} type="password" autoComplete="off" name="registerCard" id="registerCard" disabled={this.props.formDisabled} />
          <Button variant="raised" className="addMemberButton" color="primary" type="submit" disabled={this.props.formDisabled}>
            Register
          </Button>
        </div>
      </form>
    );
  }
}
