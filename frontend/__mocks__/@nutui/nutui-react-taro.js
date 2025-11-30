import React from 'react';

const Button = (props) => <button {...props} />;
const Dialog = ({ visible, children, onConfirm, onCancel, title, confirmText }) => visible ? (
    <div className="nut-dialog">
        <div className="nut-dialog-title">{title}</div>
        <div className="nut-dialog-content">{children}</div>
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onConfirm}>{confirmText || 'Confirm'}</button>
    </div>
) : null;
const Input = (props) => <input {...props} />;
const Loading = (props) => <div {...props}>{props.children || 'Loading...'}</div>;
const Tag = ({ plain, ...props }) => <span {...props} />;
const Toast = (props) => <div {...props} />;

export { Button, Dialog, Input, Loading, Tag, Toast };
