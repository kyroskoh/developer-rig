import * as React from 'react';

interface Props {
  type: string;
  name: string;
  value: number | string;
  checked?: boolean;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  text: string;
  isGrid?: boolean;
}

export function PropertyValue(props: Props) {
  return props.isGrid ? (
    <label className="project-dialog-property__value project-dialog-property__value--grid">
      <span className="project-dialog-property__left-text project-dialog-property__left-text--grid">{props.text}</span>
      <input className={props.type} type="text" name={props.name} value={props.value} onChange={props.onChange} />
    </label>
  ) : (
    <label className="project-dialog-property__value">
      <input className="project-dialog-property__left-input" type={props.type} name={props.name} value={props.value} checked={props.checked} onChange={props.onChange} />
      <span className="project-dialog-property__right-text">{props.text}</span>
    </label>
  );
}
