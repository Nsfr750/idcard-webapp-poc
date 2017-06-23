import React from 'react';

export default class Form extends React.Component {
    constructor (props) {
        super(props);
        this.state = { card: ""};
    }
    registerUser() {
        if(this.state.card) {
            let cardnum = this.state.card;
            if(cardnum[0] === ';') {
                cardnum = cardnum.slice(1, -1);
            }
            fetch('/api/register/' + cardnum + '?verbose=true', {
                method: 'PUT'
            }).then(res => res.json())
            .then(json => {
                this.props.addUser(json);
            })
            this.setState({ card: ""});
        }
    }
    
    updateCard(e) {
        this.setState({ card: e.target.value });
    }
    render() {
        return (
            <div className="form">
                <input type="text" placeholder="magstrip/rfid" value={this.state.card} onChange={this.updateCard.bind(this)} />
                <button onClick={this.registerUser.bind(this)}>Register</button>
            </div>
        )
    }
}