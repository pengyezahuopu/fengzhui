import React from 'react';

const View = (props) => <div {...props} />;
const Text = (props) => <span {...props} />;
const Image = (props) => <img {...props} />;
const Button = (props) => <button {...props} />;
const Input = (props) => <input {...props} />;
const ScrollView = (props) => <div {...props} />;
const Map = (props) => <div data-testid="taro-map" {...props}>{props.children}</div>;
const CoverView = (props) => <div {...props} />;

export { View, Text, Image, Button, Input, ScrollView, Map, CoverView };
