import { forwardRef } from 'react';
import {
  StyleSheet,
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
} from 'react-native';

import { Colors, FontFamily, FontSize, Radius } from '@/constants/theme';

interface Props extends RNTextInputProps {}

// Input recesado sobre paper2 con border hairline. La fuente body cubre
// la mayoría de los formularios; usar el mono para códigos/share_code.
export const TextInput = forwardRef<RNTextInput, Props>(function TextInput(props, ref) {
  return (
    <RNTextInput
      ref={ref}
      {...props}
      style={[styles.input, props.style]}
      placeholderTextColor={Colors.muted}
      cursorColor={Colors.red}
      selectionColor={Colors.red}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    minHeight: 52,
    paddingHorizontal: 18,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: Colors.border,
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    color: Colors.ink,
  },
});
